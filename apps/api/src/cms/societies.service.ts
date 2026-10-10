import { Inject, Injectable } from "@nestjs/common";
import { groups, members, memberships, roles, societies, societyMembers } from "@ecclesios/db";
import type {
  Candidate,
  CreateSocietySchema,
  Society,
  SocietySummary,
  UpsertSocietySchema,
} from "@ecclesios/shared";
import {
  compareRoster,
  csvRow,
  deleteBlocker,
  hasCapability,
  kindOf,
  leaderPromotion,
  normalisePosition,
  rosterRemovalBlocker,
  societyRights,
  type MemberRole,
  type SocietyKind,
  type SocietyRights,
} from "@ecclesios/shared/domain";
import { and, asc, eq, ilike, inArray, notInArray, or, sql } from "drizzle-orm";
import type { z } from "zod";
import { AuditService } from "../audit/audit.service";
import { DomainError } from "../auth/core/errors";
import { DB, type Database } from "../db/db.module";
import { MediaService } from "../media/media.service";
import { ScopeService } from "../rbac/scope.service";

type Create = z.output<typeof CreateSocietySchema>;
type Upsert = z.output<typeof UpsertSocietySchema>;
type Row = typeof societies.$inferSelect;
type Promotion = { membershipId: string; from: MemberRole; to: MemberRole } | null;
type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

const notFound = () =>
  new DomainError(404, "SOCIETY_NOT_FOUND", "We couldn't find that society in this church.");
const denied = () => new DomainError(403, "NOT_ALLOWED", "You can't do that for this society.");
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
const fullName = (p: { firstName: string; lastName: string }) => `${p.firstName} ${p.lastName}`;

/**
 * Societies & committees (functionality §4.4–4.5, D-038). Routes are scope-checked for
 * `memberContent` on the church in the URL; finer rules (staff vs the society's own leader)
 * are decided here with societyRights.
 */
@Injectable()
export class SocietiesService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly scopes: ScopeService,
    private readonly media: MediaService,
    private readonly audit: AuditService,
  ) {}

  // ------------------------------------------------------------------ access

  private async access(actorId: string, groupId: string) {
    const a = await this.scopes.resolve(actorId, groupId);
    return { write: hasCapability(a, "write"), readRecords: hasCapability(a, "readRecords") };
  }

  private rights(
    a: { write: boolean; readRecords: boolean },
    s: Row,
    actorId: string,
  ): SocietyRights {
    return societyRights({ ...a, isLeader: s.isActive && s.leaderMemberId === actorId });
  }

  private async load(groupId: string, id: string) {
    const [s] = await this.db
      .select()
      .from(societies)
      .where(and(eq(societies.id, id), eq(societies.groupId, groupId)))
      .limit(1);
    if (!s) throw notFound();
    return s;
  }

  /** Load + check a right; 404 when the caller may not even read it (don't reveal it exists). */
  private async guarded(actorId: string, groupId: string, id: string, need: keyof SocietyRights) {
    const [s, a] = await Promise.all([this.load(groupId, id), this.access(actorId, groupId)]);
    const can = this.rights(a, s, actorId);
    if (!can.read) throw notFound();
    if (!can[need]) throw denied();
    return { s, can };
  }

  /** The church, plus its outstations for a parish: roster members may come from either. */
  private async rosterChurches(groupId: string) {
    const [g] = await this.db
      .select({ level: groups.level })
      .from(groups)
      .where(eq(groups.id, groupId))
      .limit(1);
    if (g?.level !== "PARISH") return [groupId];
    const kids = await this.db
      .select({ id: groups.id })
      .from(groups)
      .where(and(eq(groups.parentGroupId, groupId), eq(groups.level, "OUTSTATION")));
    return [groupId, ...kids.map((k) => k.id)];
  }

  /** The active membership that lets this person sit on the roster (its church, role). */
  private async eligibleMembership(groupId: string, personId: string) {
    const ids = await this.rosterChurches(groupId);
    const rows = await this.db
      .select({ m: memberships, role: roles.code, church: { id: groups.id, name: groups.name } })
      .from(memberships)
      .innerJoin(roles, eq(roles.id, memberships.roleId))
      .innerJoin(groups, eq(groups.id, memberships.groupId))
      .innerJoin(members, eq(members.id, memberships.memberId))
      .where(
        and(
          eq(memberships.memberId, personId),
          inArray(memberships.groupId, ids),
          eq(memberships.status, "ACTIVE"),
          eq(members.isDeceased, false),
        ),
      );
    // Prefer the membership in this church itself.
    return rows.find((r) => r.m.groupId === groupId) ?? rows[0] ?? null;
  }

  // ------------------------------------------------------------------ read

  private async summaries(
    rows: Row[],
    a: { write: boolean; readRecords: boolean },
    actorId: string,
  ): Promise<SocietySummary[]> {
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);
    const leaderIds = rows.map((r) => r.leaderMemberId).filter((x): x is string => !!x);
    const [counts, leaders] = await Promise.all([
      this.db
        .select({ id: societyMembers.societyId, n: sql<number>`count(*)::int` })
        .from(societyMembers)
        .where(inArray(societyMembers.societyId, ids))
        .groupBy(societyMembers.societyId),
      leaderIds.length
        ? this.db
            .select({
              id: members.id,
              firstName: members.firstName,
              lastName: members.lastName,
              photoKey: members.photoKey,
            })
            .from(members)
            .where(inArray(members.id, leaderIds))
        : Promise.resolve([]),
    ]);
    return Promise.all(
      rows.map(async (r) => {
        const l = leaders.find((x) => x.id === r.leaderMemberId);
        return {
          id: r.id,
          name: r.name,
          description: r.description,
          kind: kindOf(r.isCommittee),
          isActive: r.isActive,
          leader: l
            ? {
                id: l.id,
                name: fullName(l),
                photoUrl: l.photoKey ? await this.media.presignGet(l.photoKey) : null,
              }
            : null,
          rosterCount: counts.find((c) => c.id === r.id)?.n ?? 0,
          can: this.rights(a, r, actorId),
        };
      }),
    );
  }

  /** Staff (and the parish) see every society; a leader sees the ones they lead. */
  async list(actorId: string, groupId: string, kind: SocietyKind, archived: boolean) {
    const a = await this.access(actorId, groupId);
    const rows = await this.db
      .select()
      .from(societies)
      .where(
        and(
          eq(societies.groupId, groupId),
          eq(societies.isCommittee, kind === "COMMITTEE"),
          eq(societies.isActive, !archived),
          a.readRecords ? undefined : eq(societies.leaderMemberId, actorId),
        ),
      )
      .orderBy(asc(societies.name));
    return { items: await this.summaries(rows, a, actorId) };
  }

  async detail(actorId: string, groupId: string, id: string): Promise<Society> {
    const { s } = await this.guarded(actorId, groupId, id, "read");
    return this.view(actorId, groupId, s);
  }

  private async rosterRows(s: Row) {
    return this.db
      .select({ sm: societyMembers, p: members })
      .from(societyMembers)
      .innerJoin(members, eq(members.id, societyMembers.memberId))
      .where(eq(societyMembers.societyId, s.id));
  }

  /** Which church each person's membership is in (for parish societies with outstation members). */
  private async churchOf(groupId: string, personIds: string[]) {
    if (!personIds.length) return new Map<string, { id: string; name: string }>();
    const ids = await this.rosterChurches(groupId);
    const rows = await this.db
      .select({ personId: memberships.memberId, id: groups.id, name: groups.name })
      .from(memberships)
      .innerJoin(groups, eq(groups.id, memberships.groupId))
      .where(
        and(
          inArray(memberships.memberId, personIds),
          inArray(memberships.groupId, ids),
          eq(memberships.status, "ACTIVE"),
        ),
      );
    const map = new Map<string, { id: string; name: string }>();
    for (const r of rows)
      if (!map.has(r.personId) || r.id === groupId) map.set(r.personId, { id: r.id, name: r.name });
    return map;
  }

  private async view(actorId: string, groupId: string, s: Row): Promise<Society> {
    const a = await this.access(actorId, groupId);
    const [[summary], rows] = await Promise.all([
      this.summaries([s], a, actorId),
      this.rosterRows(s),
    ]);
    const churches = await this.churchOf(
      groupId,
      rows.map((r) => r.p.id),
    );
    const [g] = await this.db
      .select({ id: groups.id, name: groups.name })
      .from(groups)
      .where(eq(groups.id, groupId))
      .limit(1);
    const roster = await Promise.all(
      rows.map(async ({ sm, p }) => ({
        personId: p.id,
        name: fullName(p),
        firstName: p.firstName,
        lastName: p.lastName,
        photoUrl: p.photoKey ? await this.media.presignGet(p.photoKey) : null,
        telephone: p.telephone,
        email: p.email,
        position: sm.position,
        isLeader: s.leaderMemberId === p.id,
        church: churches.get(p.id) ?? g!,
        joinedAt: sm.joinedAt.toISOString(),
      })),
    );
    return { ...summary!, roster: roster.sort(compareRoster) };
  }

  /** People who can be added (active, living members of the church and — for a parish — its outstations). */
  async candidates(
    actorId: string,
    groupId: string,
    id: string,
    q: string,
  ): Promise<{ items: Candidate[] }> {
    const { s } = await this.guarded(actorId, groupId, id, "roster");
    const ids = await this.rosterChurches(groupId);
    const term = q.trim();
    const like = `%${escapeLike(term)}%`;
    const rows = await this.db
      .select({ p: members, church: { id: groups.id, name: groups.name } })
      .from(memberships)
      .innerJoin(members, eq(members.id, memberships.memberId))
      .innerJoin(groups, eq(groups.id, memberships.groupId))
      .where(
        and(
          inArray(memberships.groupId, ids),
          eq(memberships.status, "ACTIVE"),
          eq(members.isDeceased, false),
          notInArray(
            members.id,
            this.db
              .select({ id: societyMembers.memberId })
              .from(societyMembers)
              .where(eq(societyMembers.societyId, s.id)),
          ),
          term
            ? or(
                ilike(members.firstName, like),
                ilike(members.lastName, like),
                ilike(members.telephone, like),
                sql`(${members.firstName} || ' ' || ${members.lastName}) ilike ${like}`,
              )
            : undefined,
        ),
      )
      .orderBy(asc(members.lastName), asc(members.firstName))
      .limit(40);
    const seen = new Set<string>();
    const items: Candidate[] = [];
    for (const r of rows) {
      if (seen.has(r.p.id)) continue;
      seen.add(r.p.id);
      items.push({
        personId: r.p.id,
        name: fullName(r.p),
        church: r.church.name,
        telephone: r.p.telephone,
        canLead: rows.some((x) => x.p.id === r.p.id && x.church.id === groupId),
      });
    }
    return { items: items.slice(0, 20) };
  }

  // ------------------------------------------------------------------ manage (staff)

  /** Leader must be an active member of THIS church; a Parishioner is raised to Society-Leader (D-038). */
  private async applyLeader(
    tx: Tx,
    groupId: string,
    societyId: string,
    personId: string | null,
  ): Promise<Promotion> {
    if (!personId) return null;
    const [m] = await tx
      .select({ m: memberships, role: roles.code })
      .from(memberships)
      .innerJoin(roles, eq(roles.id, memberships.roleId))
      .innerJoin(members, eq(members.id, memberships.memberId))
      .where(
        and(
          eq(memberships.memberId, personId),
          eq(memberships.groupId, groupId),
          eq(memberships.status, "ACTIVE"),
          eq(members.isDeceased, false),
        ),
      )
      .limit(1);
    if (!m)
      throw new DomainError(
        400,
        "LEADER_NOT_MEMBER",
        "The leader must be an active member of this church.",
      );
    await tx.insert(societyMembers).values({ societyId, memberId: personId }).onConflictDoNothing();
    const to = leaderPromotion(m.role);
    if (to) {
      const [r] = await tx.select({ id: roles.id }).from(roles).where(eq(roles.code, to)).limit(1);
      await tx.update(memberships).set({ roleId: r!.id }).where(eq(memberships.id, m.m.id));
      return { membershipId: m.m.id, from: m.role, to };
    }
    return null;
  }

  private async assertChurch(groupId: string) {
    const [g] = await this.db
      .select({ level: groups.level })
      .from(groups)
      .where(eq(groups.id, groupId))
      .limit(1);
    if (g?.level !== "PARISH" && g?.level !== "OUTSTATION")
      throw new DomainError(400, "NOT_A_CHURCH", "Societies belong to parishes and outstations.");
  }

  private nameTaken(err: unknown) {
    return typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";
  }

  async create(actorId: string, groupId: string, b: Create, ip: string) {
    await this.assertChurch(groupId);
    const a = await this.access(actorId, groupId);
    if (!a.write) throw denied();
    let promoted = null as Promotion;
    let id: string;
    try {
      id = await this.db.transaction(async (tx) => {
        const [row] = await tx
          .insert(societies)
          .values({
            groupId,
            name: b.name,
            description: b.description,
            isCommittee: b.kind === "COMMITTEE",
            leaderMemberId: b.leaderPersonId,
          })
          .returning({ id: societies.id });
        promoted = await this.applyLeader(tx, groupId, row!.id, b.leaderPersonId);
        return row!.id;
      });
    } catch (e) {
      if (this.nameTaken(e))
        throw new DomainError(
          409,
          "NAME_TAKEN",
          "This church already has a society or committee with that name.",
        );
      throw e;
    }
    await this.audit.write({
      actorType: "MEMBER",
      actorId,
      groupId,
      action: "society.created",
      entityType: "society",
      entityId: id,
      metadata: { name: b.name, kind: b.kind, promoted },
      ip,
    });
    return this.detail(actorId, groupId, id);
  }

  async update(actorId: string, groupId: string, id: string, b: Upsert, ip: string) {
    const { s } = await this.guarded(actorId, groupId, id, "manage");
    let promoted = null as Promotion;
    try {
      await this.db.transaction(async (tx) => {
        await tx
          .update(societies)
          .set({
            name: b.name,
            description: b.description,
            leaderMemberId: b.leaderPersonId,
            updatedAt: new Date(),
          })
          .where(eq(societies.id, s.id));
        if (b.leaderPersonId !== s.leaderMemberId)
          promoted = await this.applyLeader(tx, groupId, s.id, b.leaderPersonId);
      });
    } catch (e) {
      if (this.nameTaken(e))
        throw new DomainError(
          409,
          "NAME_TAKEN",
          "This church already has a society or committee with that name.",
        );
      throw e;
    }
    await this.audit.write({
      actorType: "MEMBER",
      actorId,
      groupId,
      action: "society.updated",
      entityType: "society",
      entityId: id,
      metadata: { leaderChanged: b.leaderPersonId !== s.leaderMemberId, promoted },
      ip,
    });
    return this.detail(actorId, groupId, id);
  }

  async setActive(actorId: string, groupId: string, id: string, active: boolean, ip: string) {
    await this.guarded(actorId, groupId, id, "manage");
    await this.db
      .update(societies)
      .set({ isActive: active, updatedAt: new Date() })
      .where(eq(societies.id, id));
    await this.audit.write({
      actorType: "MEMBER",
      actorId,
      groupId,
      action: active ? "society.restored" : "society.archived",
      entityType: "society",
      entityId: id,
      ip,
    });
    return this.detail(actorId, groupId, id);
  }

  async remove(actorId: string, groupId: string, id: string, ip: string) {
    const { s } = await this.guarded(actorId, groupId, id, "manage");
    const counts = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(societyMembers)
      .where(eq(societyMembers.societyId, id));
    const blocker = deleteBlocker({ isActive: s.isActive, rosterCount: counts[0]?.n ?? 0 });
    if (blocker === "ARCHIVE_FIRST")
      throw new DomainError(
        409,
        blocker,
        "Archive it first. Archived societies keep their history.",
      );
    if (blocker === "NOT_EMPTY")
      throw new DomainError(
        409,
        blocker,
        "Take everyone off the roster before deleting it, or keep it archived.",
      );
    await this.db.delete(societies).where(eq(societies.id, id));
    await this.audit.write({
      actorType: "MEMBER",
      actorId,
      groupId,
      action: "society.deleted",
      entityType: "society",
      entityId: id,
      metadata: { name: s.name },
      ip,
    });
  }

  // ------------------------------------------------------------------ roster (staff or the leader)

  async addToRoster(
    actorId: string,
    groupId: string,
    id: string,
    personId: string,
    position: string | null,
    ip: string,
  ) {
    const { s } = await this.guarded(actorId, groupId, id, "roster");
    if (!s.isActive)
      throw new DomainError(409, "ARCHIVED", "Restore this society before changing its roster.");
    if (!(await this.eligibleMembership(groupId, personId)))
      throw new DomainError(
        400,
        "NOT_A_MEMBER",
        "Only active members of this church (or its outstations) can be added.",
      );
    const inserted = await this.db
      .insert(societyMembers)
      .values({ societyId: id, memberId: personId, position: normalisePosition(position) })
      .onConflictDoNothing()
      .returning({ id: societyMembers.memberId });
    if (!inserted.length)
      throw new DomainError(409, "ALREADY_ON_ROSTER", "This person is already on the roster.");
    await this.audit.write({
      actorType: "MEMBER",
      actorId,
      groupId,
      action: "society.roster_added",
      entityType: "society",
      entityId: id,
      metadata: { personId },
      ip,
    });
    return this.detail(actorId, groupId, id);
  }

  async setPosition(
    actorId: string,
    groupId: string,
    id: string,
    personId: string,
    position: string | null,
  ) {
    const { s } = await this.guarded(actorId, groupId, id, "roster");
    if (!s.isActive)
      throw new DomainError(409, "ARCHIVED", "Restore this society before changing its roster.");
    const done = await this.db
      .update(societyMembers)
      .set({ position: normalisePosition(position) })
      .where(and(eq(societyMembers.societyId, id), eq(societyMembers.memberId, personId)))
      .returning({ id: societyMembers.memberId });
    if (!done.length)
      throw new DomainError(404, "NOT_ON_ROSTER", "This person isn't on the roster.");
    return this.detail(actorId, groupId, id);
  }

  async removeFromRoster(
    actorId: string,
    groupId: string,
    id: string,
    personId: string,
    ip: string,
  ) {
    const { s } = await this.guarded(actorId, groupId, id, "roster");
    if (!s.isActive)
      throw new DomainError(409, "ARCHIVED", "Restore this society before changing its roster.");
    if (rosterRemovalBlocker(personId, s.leaderMemberId))
      throw new DomainError(
        409,
        "IS_LEADER",
        "Choose another leader before taking the leader off the roster.",
      );
    const done = await this.db
      .delete(societyMembers)
      .where(and(eq(societyMembers.societyId, id), eq(societyMembers.memberId, personId)))
      .returning({ id: societyMembers.memberId });
    if (!done.length)
      throw new DomainError(404, "NOT_ON_ROSTER", "This person isn't on the roster.");
    await this.audit.write({
      actorType: "MEMBER",
      actorId,
      groupId,
      action: "society.roster_removed",
      entityType: "society",
      entityId: id,
      metadata: { personId },
      ip,
    });
    return this.detail(actorId, groupId, id);
  }

  async rosterCsv(actorId: string, groupId: string, id: string, ip: string) {
    const society = await this.detail(actorId, groupId, id);
    const lines = [
      csvRow(["Name", "Position", "Leader", "Phone", "Email", "Church", "On roster since"]),
      ...society.roster.map((r) =>
        csvRow([
          r.name,
          r.position ?? "",
          r.isLeader ? "Yes" : "",
          r.telephone ?? "",
          r.email ?? "",
          r.church.name,
          r.joinedAt.slice(0, 10),
        ]),
      ),
    ];
    await this.audit.write({
      actorType: "MEMBER",
      actorId,
      groupId,
      action: "society.exported",
      entityType: "society",
      entityId: id,
      metadata: { rows: society.roster.length },
      ip,
    });
    return "\uFEFF" + lines.join("\r\n") + "\r\n";
  }
}
