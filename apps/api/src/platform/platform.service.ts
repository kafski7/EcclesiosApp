import { Inject, Injectable } from "@nestjs/common";
import { groups, members, memberships } from "@ecclesios/db";
import type { PlatformOverview, PlatformSubscriptionRow, PlanCode } from "@ecclesios/shared";
import {
  evaluateSubscription,
  isCmsOpen,
  latestSubscription,
  pathIds,
} from "@ecclesios/shared/domain";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { DB, type Database } from "../db/db.module";
import { SubscriptionsService } from "../subscriptions/subscriptions.service";

/** Super-Admin console data (todo Phase 4: platform overview + subscription list). */
@Injectable()
export class PlatformService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly subs: SubscriptionsService,
  ) {}

  async subscriptionList(now = new Date()): Promise<PlatformSubscriptionRow[]> {
    const parishes = await this.db
      .select({ id: groups.id, name: groups.name, code: groups.code, path: groups.path })
      .from(groups)
      .where(and(eq(groups.level, "PARISH"), eq(groups.isActive, true)))
      .orderBy(asc(groups.name));
    if (!parishes.length) return [];
    const ids = parishes.map((p) => p.id);
    const ancestorIds = [...new Set(parishes.flatMap((p) => pathIds(p.path).slice(0, -1)))];
    const [ancestors, outs, history] = await Promise.all([
      this.db
        .select({ id: groups.id, name: groups.name, level: groups.level })
        .from(groups)
        .where(inArray(groups.id, ancestorIds)),
      this.db
        .select({ parent: groups.parentGroupId, n: sql<number>`count(*)::int` })
        .from(groups)
        .where(
          and(
            eq(groups.level, "OUTSTATION"),
            eq(groups.isActive, true),
            inArray(groups.parentGroupId, ids),
          ),
        )
        .groupBy(groups.parentGroupId),
      this.subs.historyFor(ids),
    ]);
    const anc = new Map(ancestors.map((a) => [a.id, a]));
    return parishes.map((p) => {
      const rows = history.get(p.id) ?? [];
      const latest = latestSubscription(rows);
      const ev = evaluateSubscription(latest, now);
      const diocese = pathIds(p.path)
        .slice(0, -1)
        .reverse()
        .map((id) => anc.get(id))
        .find((a) => a?.level === "DIOCESE" || a?.level === "ARCHDIOCESE");
      return {
        parish: { id: p.id, name: p.name, code: p.code },
        diocese: diocese?.name ?? null,
        outstations: outs.find((o) => o.parent === p.id)?.n ?? 0,
        state: ev.state,
        plan: latest ? { code: latest.planCode as PlanCode, name: latest.planName } : null,
        expiresAt: latest ? latest.expiresAt.toISOString() : null,
        daysLeft: ev.daysLeft,
        smsBalance: latest && isCmsOpen(ev.state) ? latest.smsBalance : 0,
      };
    });
  }

  async overview(now = new Date()): Promise<PlatformOverview> {
    const count = sql<number>`count(*)::int`;
    const [levels, [people], [pending], list] = await Promise.all([
      this.db
        .select({ level: groups.level, n: count })
        .from(groups)
        .where(and(eq(groups.isActive, true), inArray(groups.level, ["PARISH", "OUTSTATION"])))
        .groupBy(groups.level),
      this.db.select({ n: count }).from(members).where(eq(members.isActive, true)),
      this.db.select({ n: count }).from(memberships).where(eq(memberships.status, "PENDING")),
      this.subscriptionList(now),
    ]);
    const parishes = levels.find((l) => l.level === "PARISH")?.n ?? 0;
    const outstations = levels.find((l) => l.level === "OUTSTATION")?.n ?? 0;
    const by = (s: string) => list.filter((r) => r.state === s).length;
    return {
      churches: { parishes, outstations, total: parishes + outstations },
      people: { members: people?.n ?? 0, pendingMemberships: pending?.n ?? 0 },
      subscriptions: {
        active: by("ACTIVE"),
        trial: by("TRIAL"),
        expired: by("EXPIRED"),
        none: by("NONE"),
        expiringSoon: list.filter(
          (r) => isCmsOpen(r.state) && r.daysLeft !== null && r.daysLeft < 14,
        ).length,
      },
    };
  }
}
