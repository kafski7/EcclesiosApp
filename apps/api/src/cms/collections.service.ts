import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import {
  groups,
  groupSettings,
  members,
  pendingCollections,
} from "@ecclesios/db";
import type {
  CollectionList,
  CollectionRow,
  FinanceSummary,
  RecordCollectionSchema,
} from "@ecclesios/shared";
import {
  collectionDateProblem,
  isCollectionEditable,
  nextCollectionStatus,
  sumAmounts,
  toIsoDate,
  type CollectionAction,
  type CollectionStatus,
} from "@ecclesios/shared/domain";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { z } from "zod";
import { ACCOUNTING, type AccountingGateway } from "../accounting/accounting.gateway";
import { AuditService } from "../audit/audit.service";
import { DomainError } from "../auth/core/errors";
import { DB, type Database } from "../db/db.module";
import type { JobContext } from "../jobs/job.types";
import { Jobs } from "../jobs/jobs.service";
import { NotifyService } from "../notify/notify.service";
import { ChurchService } from "./church.service";

type RecordInput = z.output<typeof RecordCollectionSchema>;
type Row = typeof pendingCollections.$inferSelect;
const PAGE = 30;
const notFound = () =>
  new DomainError(404, "COLLECTION_NOT_FOUND", "We couldn't find that collection here.");
const recorder = alias(members, "recorder");
const reviewer = alias(members, "reviewer");

/**
 * Outstation collections (blueprint §8.1, D-001, D-041): outstation staff record, the parish's
 * Administrators approve or reject, approved entries are posted to the accounting service.
 * Routes are scope-checked for the church in the URL; who-may-do-what is decided here.
 */
@Injectable()
export class CollectionsService implements OnModuleInit {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ACCOUNTING) private readonly accounting: AccountingGateway,
    private readonly church: ChurchService,
    private readonly audit: AuditService,
    private readonly jobs: Jobs,
    private readonly notifier: NotifyService,
  ) {}

  onModuleInit() {
    this.jobs.handle("collection.sync", (j, ctx) =>
      this.syncNow(j.collectionId, j.actorId, j.parishId, j.ip, ctx),
    );
  }

  private async churchOf(groupId: string) {
    const [g] = await this.db
      .select({
        id: groups.id,
        name: groups.name,
        level: groups.level,
        parentId: groups.parentGroupId,
        currency: groups.currencyCode,
        backdate: groupSettings.allowManualTransactionDates,
      })
      .from(groups)
      .leftJoin(groupSettings, eq(groupSettings.groupId, groups.id))
      .where(eq(groups.id, groupId))
      .limit(1);
    if (!g) throw new DomainError(404, "NOT_FOUND", "Church not found.");
    if (g.level !== "OUTSTATION" && g.level !== "PARISH")
      throw new DomainError(
        400,
        "NOT_A_CHURCH",
        "Collections are kept by parishes and outstations.",
      );
    return { ...g, currency: g.currency ?? "GHS", backdate: g.backdate ?? false };
  }

  // ------------------------------------------------------------------ list

  async list(
    actorId: string,
    groupId: string,
    q: { status?: CollectionStatus; page: number },
  ): Promise<CollectionList> {
    const g = await this.churchOf(groupId);
    const mode = g.level === "OUTSTATION" ? "RECORD" : "REVIEW";
    const scope =
      mode === "RECORD"
        ? eq(pendingCollections.groupId, groupId)
        : eq(pendingCollections.parishGroupId, groupId);
    const isAdmin = mode === "REVIEW" && (await this.church.isAdministratorOf(actorId, groupId));
    const rows = await this.db
      .select({
        c: pendingCollections,
        outstation: { id: groups.id, name: groups.name },
        rf: recorder.firstName,
        rl: recorder.lastName,
        vf: reviewer.firstName,
        vl: reviewer.lastName,
      })
      .from(pendingCollections)
      .innerJoin(groups, eq(groups.id, pendingCollections.groupId))
      .innerJoin(recorder, eq(recorder.id, pendingCollections.recordedByMemberId))
      .leftJoin(reviewer, eq(reviewer.id, pendingCollections.reviewedByMemberId))
      .where(and(scope, q.status ? eq(pendingCollections.status, q.status) : undefined))
      .orderBy(
        desc(sql`(${pendingCollections.status} = 'PENDING')`),
        desc(pendingCollections.collectedOn),
        desc(pendingCollections.createdAt),
      )
      .limit(PAGE + 1)
      .offset((q.page - 1) * PAGE);
    const pending = await this.db
      .select({ amount: pendingCollections.amount })
      .from(pendingCollections)
      .where(and(scope, eq(pendingCollections.status, "PENDING")));
    const items: CollectionRow[] = rows.slice(0, PAGE).map((r) => ({
      id: r.c.id,
      outstation: r.outstation,
      amount: r.c.amount,
      currencyCode: r.c.currencyCode,
      categoryRef: r.c.categoryRef,
      collectedOn: r.c.collectedOn,
      note: r.c.note,
      status: r.c.status,
      recordedBy: `${r.rf} ${r.rl}`,
      reviewedBy: r.vf ? `${r.vf} ${r.vl}` : null,
      reviewedAt: r.c.reviewedAt?.toISOString() ?? null,
      reviewNote: r.c.reviewNote,
      externalTxnId: r.c.externalTxnId,
      lastSyncError: r.c.lastSyncError,
      createdAt: r.c.createdAt.toISOString(),
      can: {
        edit:
          mode === "RECORD" &&
          isCollectionEditable(r.c.status) &&
          r.c.recordedByMemberId === actorId,
        review: isAdmin && r.c.status === "PENDING",
        retry: isAdmin && r.c.status === "SYNC_FAILED" && this.accounting.connected,
      },
    }));
    return {
      items,
      page: q.page,
      hasMore: rows.length > PAGE,
      pending: { count: pending.length, total: sumAmounts(pending.map((p) => p.amount)) },
      mode,
      currencyCode: g.currency,
      allowBackdating: g.backdate,
    };
  }

  // ------------------------------------------------------------------ record (outstation staff)

  private checkDate(date: string | undefined, allow: boolean) {
    const today = toIsoDate(new Date());
    const d = date ?? today;
    const problem = collectionDateProblem(d, today, allow);
    if (problem)
      throw new DomainError(400, "INVALID_DATE", problem, {
        fieldErrors: { collectedOn: [problem] },
      });
    return d;
  }

  async record(actorId: string, groupId: string, b: RecordInput, ip: string) {
    const g = await this.churchOf(groupId);
    if (g.level !== "OUTSTATION" || !g.parentId)
      throw new DomainError(
        400,
        "NOT_AN_OUTSTATION",
        "Collections are recorded by outstations; the parish keeps its own in the accounting service.",
      );
    const collectedOn = this.checkDate(b.collectedOn, g.backdate);
    const [row] = await this.db
      .insert(pendingCollections)
      .values({
        groupId,
        parishGroupId: g.parentId,
        amount: b.amount,
        currencyCode: g.currency,
        categoryRef: b.categoryRef,
        collectedOn,
        note: b.note,
        recordedByMemberId: actorId,
      })
      .returning();
    await this.audit.write({
      actorType: "MEMBER",
      actorId,
      groupId,
      action: "collection.recorded",
      entityType: "collection",
      entityId: row!.id,
      metadata: { amount: b.amount, category: b.categoryRef },
      ip,
    });
    await this.notifyParish(
      g.parentId,
      `${g.name} recorded a collection of ${g.currency} ${b.amount}`,
      "/admin/collections",
    );
    return row!;
  }

  private async mine(actorId: string, groupId: string, id: string) {
    const [c] = await this.db
      .select()
      .from(pendingCollections)
      .where(and(eq(pendingCollections.id, id), eq(pendingCollections.groupId, groupId)))
      .limit(1);
    if (!c) throw notFound();
    if (!isCollectionEditable(c.status))
      throw new DomainError(
        409,
        "NOT_EDITABLE",
        "Only collections waiting for the parish can be changed.",
      );
    if (c.recordedByMemberId !== actorId)
      throw new DomainError(403, "NOT_ALLOWED", "Only the person who recorded it can change it.");
    return c;
  }

  async update(actorId: string, groupId: string, id: string, b: RecordInput, ip: string) {
    const g = await this.churchOf(groupId);
    await this.mine(actorId, groupId, id);
    const collectedOn = this.checkDate(b.collectedOn, g.backdate);
    // The status guard makes a concurrent approval win over a late edit.
    const done = await this.db
      .update(pendingCollections)
      .set({
        amount: b.amount,
        categoryRef: b.categoryRef,
        collectedOn,
        note: b.note,
        updatedAt: new Date(),
      })
      .where(and(eq(pendingCollections.id, id), eq(pendingCollections.status, "PENDING")))
      .returning({ id: pendingCollections.id });
    if (!done.length)
      throw new DomainError(409, "NOT_EDITABLE", "The parish has already reviewed it.");
    await this.audit.write({
      actorType: "MEMBER",
      actorId,
      groupId,
      action: "collection.updated",
      entityType: "collection",
      entityId: id,
      metadata: { amount: b.amount },
      ip,
    });
  }

  async remove(actorId: string, groupId: string, id: string, ip: string) {
    await this.mine(actorId, groupId, id);
    const done = await this.db
      .delete(pendingCollections)
      .where(and(eq(pendingCollections.id, id), eq(pendingCollections.status, "PENDING")))
      .returning({ id: pendingCollections.id });
    if (!done.length)
      throw new DomainError(409, "NOT_EDITABLE", "The parish has already reviewed it.");
    await this.audit.write({
      actorType: "MEMBER",
      actorId,
      groupId,
      action: "collection.deleted",
      entityType: "collection",
      entityId: id,
      ip,
    });
  }

  // ------------------------------------------------------------------ review (parish Administrators)

  private async forParish(actorId: string, parishId: string, id: string) {
    if (!(await this.church.isAdministratorOf(actorId, parishId)))
      throw new DomainError(
        403,
        "NOT_ALLOWED",
        "Only the parish's Administrators approve collections.",
      );
    const [c] = await this.db
      .select()
      .from(pendingCollections)
      .where(and(eq(pendingCollections.id, id), eq(pendingCollections.parishGroupId, parishId)))
      .limit(1);
    if (!c) throw notFound();
    return c;
  }

  private transition(c: Row, action: CollectionAction) {
    try {
      return nextCollectionStatus(c.status, action);
    } catch {
      throw new DomainError(
        409,
        "INVALID_TRANSITION",
        "This collection has already been dealt with.",
      );
    }
  }

  async review(
    actorId: string,
    parishId: string,
    id: string,
    decision: "approve" | "reject",
    note: string | undefined,
    ip: string,
  ) {
    const c = await this.forParish(actorId, parishId, id);
    const to = this.transition(c, decision);
    const done = await this.db
      .update(pendingCollections)
      .set({
        status: to,
        reviewedByMemberId: actorId,
        reviewedAt: new Date(),
        reviewNote: note ?? null,
        updatedAt: new Date(),
      })
      .where(and(eq(pendingCollections.id, id), eq(pendingCollections.status, "PENDING")))
      .returning();
    if (!done.length)
      throw new DomainError(
        409,
        "INVALID_TRANSITION",
        "This collection has already been dealt with.",
      );
    await this.audit.write({
      actorType: "MEMBER",
      actorId,
      groupId: parishId,
      action: `collection.${decision === "approve" ? "approved" : "rejected"}`,
      entityType: "collection",
      entityId: id,
      metadata: { note },
      ip,
    });
    const [o] = await this.db
      .select({ name: groups.name })
      .from(groups)
      .where(eq(groups.id, c.groupId))
      .limit(1);
    await this.notify(
      c.recordedByMemberId,
      c.groupId,
      decision === "approve"
        ? `Collection of ${c.currencyCode} ${c.amount} approved`
        : `Collection of ${c.currencyCode} ${c.amount} not approved`,
      decision === "reject" ? (note ?? null) : (o?.name ?? null),
    );
    if (decision === "approve") await this.sync(done[0]!, actorId, parishId, ip);
  }

  async retry(actorId: string, parishId: string, id: string, ip: string) {
    const c = await this.forParish(actorId, parishId, id);
    const to = this.transition(c, "retry");
    const done = await this.db
      .update(pendingCollections)
      .set({ status: to, updatedAt: new Date() })
      .where(and(eq(pendingCollections.id, id), eq(pendingCollections.status, "SYNC_FAILED")))
      .returning();
    if (!done.length)
      throw new DomainError(
        409,
        "INVALID_TRANSITION",
        "This collection has already been dealt with.",
      );
    await this.sync(done[0]!, actorId, parishId, ip);
  }

  /**
   * APPROVED → SYNCED / SYNC_FAILED, on the accounting worker with retries (Phase 7, D-052).
   * With no accounting service connected the entry stays APPROVED.
   */
  private async sync(c: Row, actorId: string, parishId: string, ip: string) {
    if (!this.accounting.connected) return;
    await this.jobs.add("collection.sync", { collectionId: c.id, actorId, parishId, ip });
  }

  /** One attempt. A failure before the last attempt is noted and retried; the last one is final. */
  private async syncNow(
    id: string,
    actorId: string,
    parishId: string,
    ip: string | null,
    ctx: JobContext,
  ) {
    if (!this.accounting.connected) return;
    const [c] = await this.db
      .select()
      .from(pendingCollections)
      .where(eq(pendingCollections.id, id))
      .limit(1);
    if (!c || c.status !== "APPROVED") return; // already dealt with (or retried elsewhere)
    try {
      const externalId = await this.accounting.post({
        id: c.id,
        groupId: c.groupId,
        parishGroupId: c.parishGroupId,
        amount: c.amount,
        currencyCode: c.currencyCode,
        categoryRef: c.categoryRef,
        collectedOn: c.collectedOn,
        note: c.note,
      });
      await this.db
        .update(pendingCollections)
        .set({
          status: nextCollectionStatus("APPROVED", "syncOk"),
          externalTxnId: externalId,
          syncedAt: new Date(),
          lastSyncError: null,
          syncAttempts: c.syncAttempts + 1,
        })
        .where(and(eq(pendingCollections.id, c.id), eq(pendingCollections.status, "APPROVED")));
      await this.audit.write({
        actorType: "SYSTEM",
        actorId,
        groupId: parishId,
        action: "collection.synced",
        entityType: "collection",
        entityId: c.id,
        metadata: { externalId, provider: this.accounting.name },
        ip,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message.slice(0, 500) : "Unknown error";
      await this.db
        .update(pendingCollections)
        .set({
          ...(ctx.final ? { status: nextCollectionStatus("APPROVED", "syncFail") } : {}),
          lastSyncError: message,
          syncAttempts: c.syncAttempts + 1,
        })
        .where(and(eq(pendingCollections.id, c.id), eq(pendingCollections.status, "APPROVED")));
      if (!ctx.final) throw e; // the worker retries with backoff
      await this.audit.write({
        actorType: "SYSTEM",
        actorId,
        groupId: parishId,
        action: "collection.sync_failed",
        entityType: "collection",
        entityId: c.id,
        metadata: { error: message, attempts: ctx.attempt },
        ip,
      });
    }
  }

  // ------------------------------------------------------------------ finance summary (read-only)

  async finance(groupId: string): Promise<FinanceSummary> {
    const g = await this.churchOf(groupId);
    const ids =
      g.level === "PARISH"
        ? [
            groupId,
            ...(
              await this.db
                .select({ id: groups.id })
                .from(groups)
                .where(eq(groups.parentGroupId, groupId))
            ).map((x) => x.id),
          ]
        : [groupId];
    const today = toIsoDate(new Date());
    const [month, year, waiting, failed] = await Promise.all([
      this.accounting.totals(ids, `${today.slice(0, 7)}-01`),
      this.accounting.totals(ids, `${today.slice(0, 4)}-01-01`),
      this.db
        .select({ amount: pendingCollections.amount })
        .from(pendingCollections)
        .where(
          and(inArray(pendingCollections.groupId, ids), eq(pendingCollections.status, "PENDING")),
        ),
      this.db
        .select({ n: sql<number>`count(*)::int` })
        .from(pendingCollections)
        .where(
          and(
            inArray(pendingCollections.groupId, ids),
            eq(pendingCollections.status, "SYNC_FAILED"),
          ),
        ),
    ]);
    return {
      connected: this.accounting.connected,
      provider: this.accounting.name,
      currencyCode: g.currency,
      month,
      year,
      awaitingApproval: { count: waiting.length, total: sumAmounts(waiting.map((w) => w.amount)) },
      failedSync: failed[0]?.n ?? 0,
    };
  }

  // ------------------------------------------------------------------ notifications (worker, D-052)

  private notify(memberId: string, groupId: string, title: string, body: string | null) {
    return this.notifier.people(
      "COLLECTION_REVIEW",
      { memberIds: [memberId] },
      { title, body, link: "/admin/collections" },
      groupId,
    );
  }

  private notifyParish(parishId: string, title: string, link: string) {
    return this.notifier.staff("COLLECTION_REVIEW", [parishId], ["ADMINISTRATOR"], { title, link });
  }
}
