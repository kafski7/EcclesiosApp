import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  groups,
  memberships,
  roles,
  subscriptionTypes,
  subscriptions,
} from "@ecclesios/db";
import type {
  GrantSubscriptionRequest,
  Plan,
  PlanCode,
  SubscriptionSummary,
} from "@ecclesios/shared";
import {
  canStartTrial,
  evaluateSubscription,
  isCmsOpen,
  latestSubscription,
  subscriptionHolderId,
  type GroupNode,
} from "@ecclesios/shared/domain";
import { and, asc, eq, inArray } from "drizzle-orm";
import { AuditService } from "../audit/audit.service";
import { NotifyService } from "../notify/notify.service";
import { DomainError } from "../auth/core/errors";
import { DB, type Database } from "../db/db.module";

type GroupRef = Pick<GroupNode, "id" | "level" | "path">;

export interface SubRow {
  id: string;
  groupId: string;
  status: "TRIAL" | "ACTIVE" | "EXPIRED" | "CANCELLED";
  startsAt: Date;
  expiresAt: Date;
  smsBalance: number;
  planCode: string;
  planName: string;
}

export const subscriptionRequired = (state: string) =>
  new DomainError(
    402,
    "SUBSCRIPTION_REQUIRED",
    state === "NONE"
      ? "This church has not subscribed to Church Management yet."
      : "This church's Church Management subscription has expired.",
    { state },
  );

/**
 * Platform subscriptions (functionality §4.11, §6; D-020, D-021).
 * Rules (holder, state, trial eligibility) live in @ecclesios/shared/domain; this loads and writes.
 */
@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
    private readonly notify: NotifyService,
  ) {}

  async plans(): Promise<Plan[]> {
    const rows = await this.db
      .select()
      .from(subscriptionTypes)
      .where(eq(subscriptionTypes.isActive, true))
      .orderBy(asc(subscriptionTypes.price));
    return rows.map((p) => ({
      code: p.code as PlanCode,
      name: p.name,
      price: p.price,
      currencyCode: p.currencyCode,
      durationDays: p.durationDays,
      trialDays: p.trialDays,
      smsIncluded: p.smsIncluded,
      maxMembers: p.maxMembers,
      features: p.features,
    }));
  }

  private async plan(code: PlanCode) {
    const [p] = await this.db
      .select()
      .from(subscriptionTypes)
      .where(eq(subscriptionTypes.code, code))
      .limit(1);
    if (!p || !p.isActive)
      throw new DomainError(400, "PLAN_NOT_FOUND", "That plan is not available.");
    return p;
  }

  /** Every subscription row of each holder, newest first, with its plan. One query. */
  async historyFor(holderIds: string[]): Promise<Map<string, SubRow[]>> {
    const map = new Map<string, SubRow[]>();
    if (!holderIds.length) return map;
    const rows: SubRow[] = await this.rows(holderIds);
    for (const r of rows) map.set(r.groupId, [...(map.get(r.groupId) ?? []), r]);
    return map;
  }

  private rows(holderIds: string[]) {
    return this.db
      .select({
        id: subscriptions.id,
        groupId: subscriptions.groupId,
        status: subscriptions.status,
        startsAt: subscriptions.startsAt,
        expiresAt: subscriptions.expiresAt,
        smsBalance: subscriptions.smsBalance,
        planCode: subscriptionTypes.code,
        planName: subscriptionTypes.name,
      })
      .from(subscriptions)
      .innerJoin(subscriptionTypes, eq(subscriptions.subscriptionTypeId, subscriptionTypes.id))
      .where(inArray(subscriptions.groupId, holderIds));
  }

  /**
   * Summary for a church, or null when its level is not gated.
   * `callerAdministersHolder` = the caller is an ACTIVE Administrator of the holder parish itself.
   */
  async summary(
    group: GroupRef,
    callerAdministersHolder: boolean,
    now = new Date(),
  ): Promise<SubscriptionSummary | null> {
    const holderId = subscriptionHolderId(group);
    if (!holderId) return null;
    const [holder] = await this.db
      .select({ id: groups.id, name: groups.name })
      .from(groups)
      .where(eq(groups.id, holderId));
    if (!holder) return null;
    const rows = (await this.historyFor([holderId])).get(holderId) ?? [];
    return this.toSummary(holder, rows, callerAdministersHolder, now);
  }

  toSummary(
    holder: { id: string; name: string },
    rows: SubRow[],
    callerAdministersHolder: boolean,
    now = new Date(),
  ): SubscriptionSummary {
    const latest = latestSubscription(rows);
    const ev = evaluateSubscription(latest, now);
    return {
      holder,
      state: ev.state,
      plan: latest ? { code: latest.planCode as PlanCode, name: latest.planName } : null,
      expiresAt: latest ? latest.expiresAt.toISOString() : null,
      daysLeft: ev.daysLeft,
      expiringSoon: ev.expiringSoon,
      smsBalance: latest && isCmsOpen(ev.state) ? latest.smsBalance : 0,
      canStartTrial: callerAdministersHolder && canStartTrial(rows),
    };
  }

  /** Throws 402 SUBSCRIPTION_REQUIRED when `groupId` is gated and closed. */
  async assertOpen(groupId: string, now = new Date()) {
    const [g] = await this.db
      .select({ id: groups.id, level: groups.level, path: groups.path })
      .from(groups)
      .where(eq(groups.id, groupId))
      .limit(1);
    if (!g) return; // the scope guard already refused unknown groups
    const s = await this.summary(g, false, now);
    if (s && !isCmsOpen(s.state)) throw subscriptionRequired(s.state);
  }

  /** One-time free trial, started by an Administrator of the parish (D-021). No SMS credit during trial. */
  async startTrial(memberId: string, groupId: string, planCode: PlanCode, ip: string) {
    const [g] = await this.db
      .select({ id: groups.id, level: groups.level, path: groups.path, name: groups.name })
      .from(groups)
      .where(eq(groups.id, groupId))
      .limit(1);
    if (!g || g.level !== "PARISH")
      throw new DomainError(
        400,
        "NOT_A_PARISH",
        "Subscriptions are held by the parish. Ask your parish to subscribe.",
      );
    if (!(await this.isAdministratorOf(memberId, g.id)))
      throw new DomainError(
        403,
        "FORBIDDEN",
        "Only the parish Administrator can start a subscription.",
      );
    const plan = await this.plan(planCode);
    const history = (await this.historyFor([g.id])).get(g.id) ?? [];
    if (!canStartTrial(history))
      throw new DomainError(
        409,
        "TRIAL_NOT_AVAILABLE",
        "This parish has already used its free trial.",
      );
    const now = new Date();
    await this.db.insert(subscriptions).values({
      groupId: g.id,
      subscriptionTypeId: plan.id,
      status: "TRIAL",
      startsAt: now,
      expiresAt: new Date(now.getTime() + Math.max(plan.trialDays, 1) * 86_400_000),
      smsBalance: 0,
    });
    await this.audit.write({
      actorType: "MEMBER",
      actorId: memberId,
      groupId: g.id,
      action: "subscription.trial_started",
      metadata: { plan: planCode, days: plan.trialDays },
      ip,
    });
    return this.summary(g, true);
  }

  /**
   * Super-Admin activation / renewal / upgrade (D-021). The live row (if any) is closed and a new
   * ACTIVE row starts now; unused days and SMS credit carry over.
   */
  async grant(userId: string, req: GrantSubscriptionRequest, ip: string) {
    const [g] = await this.db
      .select({ id: groups.id, level: groups.level, path: groups.path, name: groups.name })
      .from(groups)
      .where(eq(groups.id, req.parishId))
      .limit(1);
    if (!g || g.level !== "PARISH") throw new DomainError(400, "NOT_A_PARISH", "Choose a parish.");
    const plan = await this.plan(req.planCode);
    const now = new Date();
    const days = req.days ?? plan.durationDays;

    await this.db.transaction(async (tx) => {
      const live = await tx
        .select()
        .from(subscriptions)
        .where(
          and(eq(subscriptions.groupId, g.id), inArray(subscriptions.status, ["TRIAL", "ACTIVE"])),
        );
      const current = live[0];
      const carryMs =
        current && current.status === "ACTIVE" && current.expiresAt > now
          ? current.expiresAt.getTime() - now.getTime()
          : 0;
      const carrySms = current && current.expiresAt > now ? current.smsBalance : 0;
      if (current) {
        await tx
          .update(subscriptions)
          // keep expires_at > starts_at (subscriptions_period_chk)
          .set({
            status: "CANCELLED",
            expiresAt:
              current.expiresAt > now
                ? new Date(Math.max(now.getTime(), current.startsAt.getTime() + 1))
                : current.expiresAt,
          })
          .where(eq(subscriptions.id, current.id));
      }
      await tx.insert(subscriptions).values({
        groupId: g.id,
        subscriptionTypeId: plan.id,
        status: "ACTIVE",
        startsAt: now,
        expiresAt: new Date(now.getTime() + carryMs + days * 86_400_000),
        smsBalance: carrySms + plan.smsIncluded,
      });
    });

    await this.audit.write({
      actorType: "USER",
      actorId: userId,
      groupId: g.id,
      action: "subscription.granted",
      metadata: { plan: req.planCode, days, reference: req.reference },
      ip,
    });
    await this.notifyAdmins(g.id, `${plan.name} plan active for ${g.name}`);
    return this.summary(g, false);
  }

  private async isAdministratorOf(memberId: string, groupId: string) {
    const rows = await this.db
      .select({ id: memberships.id })
      .from(memberships)
      .innerJoin(roles, eq(memberships.roleId, roles.id))
      .where(
        and(
          eq(memberships.memberId, memberId),
          eq(memberships.groupId, groupId),
          eq(memberships.status, "ACTIVE"),
          eq(roles.code, "ADMINISTRATOR"),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }

  private notifyAdmins(groupId: string, title: string) {
    return this.notify.staff("SUBSCRIPTION", [groupId], ["ADMINISTRATOR"], {
      title,
      link: "/admin/billing",
    });
  }
}
