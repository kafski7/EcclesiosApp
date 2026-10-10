import { Inject, Injectable } from "@nestjs/common";
import { groups, members, memberships, notifications, roles, societies } from "@ecclesios/db";
import type { CmsContext, CmsContextsResponse, CmsDashboard } from "@ecclesios/shared";
import {
  hasCapability,
  pathIds,
  subscriptionHolderId,
  type MemberRole,
} from "@ecclesios/shared/domain";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { DomainError } from "../auth/core/errors";
import { DB, type Database } from "../db/db.module";
import { ScopeService } from "../rbac/scope.service";
import { SubscriptionsService } from "../subscriptions/subscriptions.service";

/** Roles that can open the CMS at all (functionality §1). Parishioners use the social platform only. */
export const CMS_ROLES: readonly MemberRole[] = ["ADMINISTRATOR", "MANAGER", "SOCIETY_LEADER"];

@Injectable()
export class CmsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly subs: SubscriptionsService,
    private readonly scopes: ScopeService,
  ) {}

  /**
   * The churches this person can manage (functionality §4.13, D-020): their ACTIVE memberships with a
   * CMS role, each with the subscription that covers it. Oversight drill-down (parish → outstations,
   * dean → parishes) is added by the Groups module in Phase 6.
   */
  async contexts(memberId: string): Promise<CmsContextsResponse> {
    const [person] = await this.db
      .select({ id: members.id, firstName: members.firstName, lastName: members.lastName })
      .from(members)
      .where(eq(members.id, memberId))
      .limit(1);
    if (!person) throw new DomainError(404, "NOT_FOUND", "Account not found.");

    const rows = await this.db
      .select({
        role: roles.code,
        group: { id: groups.id, name: groups.name, level: groups.level, path: groups.path },
      })
      .from(memberships)
      .innerJoin(roles, eq(memberships.roleId, roles.id))
      .innerJoin(groups, eq(memberships.groupId, groups.id))
      .where(
        and(
          eq(memberships.memberId, memberId),
          eq(memberships.status, "ACTIVE"),
          eq(groups.isActive, true),
          inArray(roles.code, [...CMS_ROLES]),
        ),
      )
      .orderBy(asc(groups.name));

    // Holder parishes (for subscriptions) and parent names (for outstations), batched.
    const holderIds = [
      ...new Set(rows.map((r) => subscriptionHolderId(r.group)).filter((x): x is string => !!x)),
    ];
    const parentIds = [
      ...new Set(
        rows
          .filter((r) => r.group.level === "OUTSTATION")
          .map((r) => pathIds(r.group.path).at(-2)!),
      ),
    ];
    const named =
      holderIds.length || parentIds.length
        ? await this.db
            .select({ id: groups.id, name: groups.name })
            .from(groups)
            .where(inArray(groups.id, [...new Set([...holderIds, ...parentIds])]))
        : [];
    const nameOf = new Map(named.map((n) => [n.id, n.name]));
    const history = await this.subs.historyFor(holderIds);
    const adminOf = new Set(rows.filter((r) => r.role === "ADMINISTRATOR").map((r) => r.group.id));

    const contexts: CmsContext[] = rows.map((r) => {
      const holderId = subscriptionHolderId(r.group);
      return {
        group: {
          id: r.group.id,
          name: r.group.name,
          level: r.group.level,
          parent:
            r.group.level === "OUTSTATION"
              ? (nameOf.get(pathIds(r.group.path).at(-2)!) ?? null)
              : null,
        },
        role: r.role,
        subscription: holderId
          ? this.subs.toSummary(
              { id: holderId, name: nameOf.get(holderId) ?? "" },
              history.get(holderId) ?? [],
              adminOf.has(holderId),
            )
          : null,
      };
    });
    return { person, contexts };
  }

  /** Totals across everything under the group that the viewer may count (D-041). Null for outstations. */
  private async rollup(memberId: string, groupId: string): Promise<CmsDashboard["rollup"]> {
    const { nodes, hiddenDioceses } = await this.scopes.visibleWithin(memberId, groupId);
    const root = nodes.find((n) => n.id === groupId);
    if (!root || root.level === "OUTSTATION") return null;
    const open = nodes.filter((n) => n.isActive);
    const ids = open.map((n) => n.id);
    if (!ids.length) return null;
    const count = sql<number>`count(*)::int`;
    const [[m], [p], [soc]] = await Promise.all([
      this.db
        .select({ n: sql<number>`count(distinct ${memberships.memberId})::int` })
        .from(memberships)
        .where(and(inArray(memberships.groupId, ids), eq(memberships.status, "ACTIVE"))),
      this.db
        .select({ n: count })
        .from(memberships)
        .where(and(inArray(memberships.groupId, ids), eq(memberships.status, "PENDING"))),
      this.db
        .select({ n: count })
        .from(societies)
        .where(and(inArray(societies.groupId, ids), eq(societies.isActive, true))),
    ]);
    return {
      parishes: open.filter((n) => n.level === "PARISH" && n.id !== groupId).length,
      outstations: open.filter((n) => n.level === "OUTSTATION").length,
      members: m?.n ?? 0,
      societies: soc?.n ?? 0,
      pendingRequests: p?.n ?? 0,
      hiddenDioceses,
    };
  }

  /** Dashboard counters (functionality §4.1) for one church. Roll-ups for monitoring levels come in Phase 6. */
  async dashboard(memberId: string, groupId: string): Promise<CmsDashboard> {
    const count = sql<number>`count(*)::int`;
    // Society-Leaders see what they lead, not the church's figures (D-039).
    if (!hasCapability(await this.scopes.resolve(memberId, groupId), "readAggregates")) {
      const [led, [n]] = await Promise.all([
        this.db
          .select({ committee: societies.isCommittee, n: count })
          .from(societies)
          .where(
            and(
              eq(societies.groupId, groupId),
              eq(societies.isActive, true),
              eq(societies.leaderMemberId, memberId),
            ),
          )
          .groupBy(societies.isCommittee),
        this.db
          .select({ n: count })
          .from(notifications)
          .where(
            and(
              eq(notifications.recipientMemberId, memberId),
              eq(notifications.groupId, groupId),
              isNull(notifications.readAt),
            ),
          ),
      ]);
      return {
        groupId,
        view: "LEADER",
        members: 0,
        pendingRequests: 0,
        societies: led.find((s) => !s.committee)?.n ?? 0,
        committees: led.find((s) => s.committee)?.n ?? 0,
        birthdaysToday: 0,
        unreadNotifications: n?.n ?? 0,
        rollup: null,
      };
    }
    const [[m], [p], soc, [b], [n]] = await Promise.all([
      this.db
        .select({ n: count })
        .from(memberships)
        .where(and(eq(memberships.groupId, groupId), eq(memberships.status, "ACTIVE"))),
      this.db
        .select({ n: count })
        .from(memberships)
        .where(and(eq(memberships.groupId, groupId), eq(memberships.status, "PENDING"))),
      this.db
        .select({ committee: societies.isCommittee, n: count })
        .from(societies)
        .where(and(eq(societies.groupId, groupId), eq(societies.isActive, true)))
        .groupBy(societies.isCommittee),
      this.db
        .select({ n: count })
        .from(memberships)
        .innerJoin(members, eq(memberships.memberId, members.id))
        .where(
          and(
            eq(memberships.groupId, groupId),
            eq(memberships.status, "ACTIVE"),
            eq(members.isDeceased, false),
            sql`extract(month from ${members.dateOfBirth}) = extract(month from current_date)`,
            sql`extract(day from ${members.dateOfBirth}) = extract(day from current_date)`,
          ),
        ),
      this.db
        .select({ n: count })
        .from(notifications)
        .where(
          and(
            eq(notifications.recipientMemberId, memberId),
            eq(notifications.groupId, groupId),
            isNull(notifications.readAt),
          ),
        ),
    ]);
    return {
      groupId,
      view: "FULL",
      members: m?.n ?? 0,
      pendingRequests: p?.n ?? 0,
      societies: soc.find((s) => !s.committee)?.n ?? 0,
      committees: soc.find((s) => s.committee)?.n ?? 0,
      birthdaysToday: b?.n ?? 0,
      unreadNotifications: n?.n ?? 0,
      rollup: await this.rollup(memberId, groupId),
    };
  }
}
