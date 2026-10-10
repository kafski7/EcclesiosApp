import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import {
  groups,
  messageRecipients,
  messages,
  notificationPreferences,
  notificationTypes,
  notifications,
  subscriptions,
} from "@ecclesios/db";
import {
  AudienceSchema,
  SKIP_REASONS,
  finalMessageStatus,
  personalize,
  smsSegments,
  type RecipientStatus,
} from "@ecclesios/shared";
import { and, asc, eq, gte, inArray, sql } from "drizzle-orm";
import { AuditService } from "../audit/audit.service";
import { DB, type Database } from "../db/db.module";
import type { JobContext } from "../jobs/job.types";
import { Jobs } from "../jobs/jobs.service";
import {
  EMAIL_GATEWAY,
  SMS_GATEWAY,
  type EmailGateway,
  type SendResult,
  type SmsGateway,
} from "../messaging/gateways";
import { NotifyService } from "../notify/notify.service";
import { AudienceResolver } from "./audience";
import { MessagesService, reachable } from "./messages.service";

/** Recipients per delivery job. */
export const BATCH = 50;
const INSERT_CHUNK = 1000;

type NewRecipient = typeof messageRecipients.$inferInsert;

/**
 * The Messages workers (D-051).
 *
 * expand: QUEUED → SENDING. Resolve the audience again (it's the list at send time), skip who
 *   can't be reached or switched in-app messages off, take the SMS credit for everyone else in
 *   one conditional UPDATE (no credit, no send — the message FAILS with a reason), write the
 *   recipients and queue delivery batches. In-app messages are written as notifications here.
 * deliver: send one batch. Transient failures stay PENDING and the job is retried; on the last
 *   attempt they become FAILED.
 * finish: when nothing is PENDING, the message gets its final status (exactly once), failed
 *   SMS credit goes back to the subscription, and the sender hears about failures.
 */
@Injectable()
export class MessagesProcessor implements OnModuleInit {
  private readonly logger = new Logger("Messages");
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(SMS_GATEWAY) private readonly sms: SmsGateway,
    @Inject(EMAIL_GATEWAY) private readonly email: EmailGateway,
    private readonly jobs: Jobs,
    private readonly audience: AudienceResolver,
    private readonly service: MessagesService,
    private readonly notify: NotifyService,
    private readonly audit: AuditService,
  ) {}

  onModuleInit() {
    this.jobs.handle("message.expand", (j) => this.expand(j.messageId));
    this.jobs.handle("message.deliver", (j, ctx) => this.deliver(j.messageId, j.recipientIds, ctx));
  }

  private async load(id: string) {
    const [m] = await this.db.select().from(messages).where(eq(messages.id, id)).limit(1);
    return m ?? null;
  }

  // ------------------------------------------------------------------ expand

  async expand(messageId: string) {
    const m = await this.load(messageId);
    if (!m) return;
    if (m.status === "SENDING") return this.queueDelivery(m.id); // a retry after the write
    if (m.status !== "QUEUED") return;

    const sender = await this.audience.sender(m.groupId);
    const audience = AudienceSchema.parse(m.audience);
    const people = await this.audience.resolve(sender, audience, this.service.today());

    const off =
      m.channel === "IN_APP" && people.length
        ? new Set(
            (
              await this.db
                .select({ memberId: notificationPreferences.memberId })
                .from(notificationPreferences)
                .innerJoin(notificationTypes, eq(notificationTypes.id, notificationPreferences.typeId))
                .where(
                  and(
                    eq(notificationTypes.code, "MESSAGE"),
                    eq(notificationPreferences.channel, "IN_APP"),
                    eq(notificationPreferences.enabled, false),
                  ),
                )
            ).map((r) => r.memberId),
          )
        : new Set<string>();

    const rows: NewRecipient[] = people.map((r) => {
      const base = {
        messageId: m.id,
        memberId: r.memberId,
        groupId: r.groupId,
        name: r.name.slice(0, 210),
        firstName: r.firstName.slice(0, 100),
      };
      if (!reachable(r, m.channel))
        return {
          ...base,
          status: "SKIPPED" as const,
          error:
            m.channel === "SMS"
              ? SKIP_REASONS.NO_PHONE
              : m.channel === "EMAIL"
                ? SKIP_REASONS.NO_EMAIL
                : SKIP_REASONS.NO_APP,
        };
      if (m.channel === "IN_APP" && off.has(r.memberId))
        return { ...base, status: "SKIPPED" as const, error: SKIP_REASONS.TURNED_OFF };
      if (m.channel === "SMS")
        return {
          ...base,
          destination: r.telephone,
          segments: smsSegments(personalize(m.body, { firstName: r.firstName, church: r.church })),
        };
      if (m.channel === "EMAIL") return { ...base, destination: r.email };
      return base;
    });
    const pending = rows.filter((r) => r.status !== "SKIPPED");
    const charge = pending.reduce((a, r) => a + (r.segments ?? 0), 0);
    const now = new Date();

    const outcome = await this.db.transaction(async (tx) => {
      let subscriptionId: string | null = null;
      if (m.channel === "SMS" && charge > 0) {
        const account = await this.service.smsAccount(sender);
        if (!account.subscriptionId) return "SMS_NOT_AVAILABLE" as const;
        const taken = await tx
          .update(subscriptions)
          .set({ smsBalance: sql`${subscriptions.smsBalance} - ${charge}` })
          .where(and(eq(subscriptions.id, account.subscriptionId), gte(subscriptions.smsBalance, charge)))
          .returning({ id: subscriptions.id });
        if (!taken.length) return "INSUFFICIENT_SMS_BALANCE" as const;
        subscriptionId = account.subscriptionId;
      }
      for (let i = 0; i < rows.length; i += INSERT_CHUNK)
        await tx.insert(messageRecipients).values(rows.slice(i, i + INSERT_CHUNK));

      if (m.channel === "IN_APP" && pending.length) {
        const [type] = await tx
          .select({ id: notificationTypes.id })
          .from(notificationTypes)
          .where(eq(notificationTypes.code, "MESSAGE"))
          .limit(1);
        if (type) {
          const church = new Map(people.map((p) => [p.memberId, p.church]));
          for (let i = 0; i < pending.length; i += INSERT_CHUNK)
            await tx.insert(notifications).values(
              pending.slice(i, i + INSERT_CHUNK).map((r) => ({
                typeId: type.id,
                groupId: m.groupId,
                recipientMemberId: r.memberId!,
                title: (m.subject ?? sender.name).slice(0, 200),
                body: personalize(m.body, {
                  firstName: r.firstName,
                  church: church.get(r.memberId!) ?? sender.name,
                }),
              })),
            );
          await tx
            .update(messageRecipients)
            .set({ status: "SENT", sentAt: now })
            .where(and(eq(messageRecipients.messageId, m.id), eq(messageRecipients.status, "PENDING")));
        }
      }
      await tx
        .update(messages)
        .set({
          status: "SENDING",
          startedAt: now,
          recipientCount: rows.length,
          skippedCount: rows.length - pending.length,
          subscriptionId,
          smsCharged: charge,
        })
        .where(and(eq(messages.id, m.id), eq(messages.status, "QUEUED")));
      return "OK" as const;
    });

    if (outcome !== "OK") {
      await this.db
        .update(messages)
        .set({
          status: "FAILED",
          failureReason: outcome,
          recipientCount: rows.length,
          skippedCount: rows.length - pending.length,
          finishedAt: now,
        })
        .where(and(eq(messages.id, m.id), eq(messages.status, "QUEUED")));
      await this.tellSender(m, outcome === "INSUFFICIENT_SMS_BALANCE"
        ? `Your SMS wasn't sent: not enough SMS credit (needed ${charge}).`
        : "Your SMS wasn't sent: SMS isn't available for this church.");
      return;
    }
    await this.queueDelivery(m.id);
  }

  /** Delivery jobs for whatever is still PENDING (same ids on a retry, so BullMQ drops repeats). */
  private async queueDelivery(messageId: string) {
    const m = await this.load(messageId);
    if (!m || m.status !== "SENDING") return;
    if (m.channel === "IN_APP") return this.finish(messageId);
    const ids = (
      await this.db
        .select({ id: messageRecipients.id })
        .from(messageRecipients)
        .where(and(eq(messageRecipients.messageId, messageId), eq(messageRecipients.status, "PENDING")))
        .orderBy(asc(messageRecipients.id))
    ).map((r) => r.id);
    if (!ids.length) return this.finish(messageId);
    const batches: { messageId: string; recipientIds: string[] }[] = [];
    for (let i = 0; i < ids.length; i += BATCH)
      batches.push({ messageId, recipientIds: ids.slice(i, i + BATCH) });
    await this.jobs.addBulk("message.deliver", batches);
  }

  // ------------------------------------------------------------------ deliver

  async deliver(messageId: string, recipientIds: string[], ctx: JobContext) {
    const m = await this.load(messageId);
    if (!m || m.status !== "SENDING" || !recipientIds.length) return;
    const due = await this.db
      .select({ r: messageRecipients, church: groups.name })
      .from(messageRecipients)
      .leftJoin(groups, eq(groups.id, messageRecipients.groupId))
      .where(
        and(
          inArray(messageRecipients.id, recipientIds),
          eq(messageRecipients.status, "PENDING"),
        ),
      );
    const sender = await this.audience.sender(m.groupId);
    let retry = 0;
    for (const { r, church } of due) {
      const text = personalize(m.body, { firstName: r.firstName, church: church ?? sender.name });
      let res: SendResult;
      try {
        res = !r.destination
          ? { ok: false, permanent: true, error: "No destination" }
          : m.channel === "SMS"
            ? await this.sms.send(r.destination, text)
            : await this.email.send({
                to: r.destination,
                subject: m.subject ?? sender.name,
                text: `${text}\n\n— ${sender.name}, via Ecclesios`,
              });
      } catch (e) {
        res = { ok: false, permanent: false, error: e instanceof Error ? e.message : String(e) };
      }
      const status: RecipientStatus = res.ok
        ? "SENT"
        : res.permanent || ctx.final
          ? "FAILED"
          : "PENDING";
      if (status === "PENDING") retry++;
      await this.db
        .update(messageRecipients)
        .set({
          status,
          sentAt: res.ok ? new Date() : null,
          providerRef: res.ok ? res.ref : null,
          error: res.ok ? null : res.error.slice(0, 300),
        })
        .where(and(eq(messageRecipients.id, r.id), eq(messageRecipients.status, "PENDING")));
    }
    if (retry) throw new Error(`${retry} recipient(s) to retry`);
    await this.finish(messageId);
  }

  // ------------------------------------------------------------------ finish

  async finish(messageId: string) {
    const counts = await this.db
      .select({
        status: messageRecipients.status,
        n: sql<number>`count(*)::int`,
        segments: sql<number>`coalesce(sum(${messageRecipients.segments}), 0)::int`,
      })
      .from(messageRecipients)
      .where(eq(messageRecipients.messageId, messageId))
      .groupBy(messageRecipients.status);
    const c = (s: RecipientStatus) => counts.find((x) => x.status === s);
    if (c("PENDING")?.n) return; // other batches still running
    const sent = c("SENT")?.n ?? 0;
    const failed = c("FAILED")?.n ?? 0;
    const skipped = c("SKIPPED")?.n ?? 0;
    const refund = c("FAILED")?.segments ?? 0;

    const done = await this.db.transaction(async (tx) => {
      const [m] = await tx
        .update(messages)
        .set({
          status: finalMessageStatus(sent, failed),
          sentCount: sent,
          failedCount: failed,
          skippedCount: skipped,
          smsRefunded: sql`least(${messages.smsCharged}, ${refund})`,
          finishedAt: new Date(),
        })
        .where(and(eq(messages.id, messageId), eq(messages.status, "SENDING")))
        .returning();
      if (!m) return null; // someone else finished it
      if (m.subscriptionId && m.smsRefunded > 0)
        await tx
          .update(subscriptions)
          .set({ smsBalance: sql`${subscriptions.smsBalance} + ${m.smsRefunded}` })
          .where(eq(subscriptions.id, m.subscriptionId));
      return m;
    });
    if (!done) return;
    await this.audit.write({
      actorType: "SYSTEM",
      groupId: done.groupId,
      action: "message.finished",
      entityType: "message",
      entityId: done.id,
      metadata: { status: done.status, sent, failed, skipped, smsUsed: done.smsCharged - done.smsRefunded },
    });
    if (failed > 0)
      await this.tellSender(
        done,
        done.status === "FAILED"
          ? `Your ${label(done.channel)} wasn't delivered (${failed} failed).`
          : `Your ${label(done.channel)}: ${sent} sent, ${failed} failed.`,
      );
  }

  private tellSender(m: typeof messages.$inferSelect, title: string) {
    if (!m.senderMemberId) return Promise.resolve();
    return this.notify.people(
      "MESSAGE",
      { memberIds: [m.senderMemberId] },
      { title, body: m.audienceLabel, link: `/admin/messages/${m.id}` },
      m.groupId,
    );
  }
}

const label = (c: string) => (c === "SMS" ? "SMS" : c === "EMAIL" ? "email" : "message");
