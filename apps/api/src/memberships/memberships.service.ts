import { Inject, Injectable } from "@nestjs/common";
import {
  follows,
  groups,
  homeTransfers,
  memberPrivileges,
  members,
  memberships,
  roles,
} from "@ecclesios/db";
import type {
  HomeTransferRequest,
  MeResponse,
  MembershipDecision,
  MembershipRequest,
  MyHomeTransfer,
  MyMembership,
} from "@ecclesios/shared";
import {
  homeTransferBlocker,
  InvalidMembershipTransition,
  nextHomeTransferStatus,
  nextMembershipStatus,
} from "@ecclesios/shared/domain";
import { alias } from "drizzle-orm/pg-core";
import { and, asc, eq, ne } from "drizzle-orm";
import { AuditService } from "../audit/audit.service";
import { NotifyService } from "../notify/notify.service";
import { DomainError } from "../auth/core/errors";
import { DB, type Database } from "../db/db.module";
import { ScopeService } from "../rbac/scope.service";
import { ChurchesService } from "./churches.service";

const notFound = () =>
  new DomainError(404, "MEMBERSHIP_NOT_FOUND", "That membership request no longer exists.");
const transferNotFound = () =>
  new DomainError(404, "TRANSFER_NOT_FOUND", "That home-church request no longer exists.");
const BLOCKER_MESSAGE: Record<string, string> = {
  NOT_AN_ACTIVE_MEMBER: "You can only move your home to a church where you're an active member.",
  ALREADY_HOME: "That's already your home church.",
};
const fromGroups = alias(groups, "from_groups");
const toGroups = alias(groups, "to_groups");
const notAllowed = () =>
  new DomainError(
    403,
    "NOT_ALLOWED",
    "Only this church's Administrator, or its parish, can decide this request.",
  );

/** Joining, leaving, following and approving (functionality §2.4–2.5, D-014 – D-016). */
@Injectable()
export class MembershipsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly churches: ChurchesService,
    private readonly scopes: ScopeService,
    private readonly audit: AuditService,
    private readonly notify: NotifyService,
  ) {}

  // ------------------------------------------------------------------ me
  async me(memberId: string): Promise<MeResponse> {
    const [p] = await this.db.select().from(members).where(eq(members.id, memberId)).limit(1);
    if (!p) throw new DomainError(404, "NOT_FOUND", "Account not found.");
    const [mine, followed, grants, transfer] = await Promise.all([
      this.myMemberships(memberId),
      this.db
        .select({ id: groups.id, name: groups.name, level: groups.level })
        .from(follows)
        .innerJoin(groups, eq(follows.groupId, groups.id))
        .where(eq(follows.memberId, memberId))
        .orderBy(asc(groups.name)),
      this.db
        .select({ privilege: memberPrivileges.privilege })
        .from(memberPrivileges)
        .where(eq(memberPrivileges.memberId, memberId)),
      this.openTransfer(memberId),
    ]);
    return {
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      email: p.email,
      telephone: p.telephone,
      privileges: grants.map((g) => g.privilege),
      memberships: mine,
      follows: followed,
      homeTransfer: transfer,
    };
  }

  private async myMemberships(memberId: string): Promise<MyMembership[]> {
    const rows = await this.db
      .select({
        id: memberships.id,
        status: memberships.status,
        isHome: memberships.isHome,
        requestedAt: memberships.requestedAt,
        role: roles.code,
        church: { id: groups.id, name: groups.name, level: groups.level },
      })
      .from(memberships)
      .innerJoin(groups, eq(memberships.groupId, groups.id))
      .innerJoin(roles, eq(memberships.roleId, roles.id))
      .where(eq(memberships.memberId, memberId))
      .orderBy(asc(groups.name));
    return rows
      .filter((r) => r.status === "PENDING" || r.status === "ACTIVE")
      .map((r) => ({ ...r, requestedAt: r.requestedAt.toISOString() }));
  }

  // ------------------------------------------------------------------ join / leave
  async join(memberId: string, groupId: string, ip: string): Promise<MyMembership> {
    const church = await this.churches.findJoinable(groupId);
    if (!church)
      throw new DomainError(404, "CHURCH_NOT_FOUND", "That church isn't available to join.");
    const [role] = await this.db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.code, "PARISHIONER"))
      .limit(1);
    if (!role) throw new DomainError(500, "SETUP_INCOMPLETE", "Joining is not available yet.");

    const existing = await this.db
      .select({ id: memberships.id, status: memberships.status })
      .from(memberships)
      .where(and(eq(memberships.memberId, memberId), eq(memberships.groupId, groupId)))
      .limit(1);
    const hasHome =
      (
        await this.db
          .select({ id: memberships.id })
          .from(memberships)
          .where(and(eq(memberships.memberId, memberId), eq(memberships.isHome, true)))
          .limit(1)
      ).length > 0;

    const prior = existing[0];
    if (prior?.status === "ACTIVE")
      throw new DomainError(409, "ALREADY_MEMBER", "You're already a member of this church.");
    if (prior?.status === "PENDING")
      throw new DomainError(
        409,
        "REQUEST_PENDING",
        "Your request to join is waiting for approval.",
      );

    await this.db.transaction(async (tx) => {
      if (prior) {
        nextMembershipStatus(prior.status, "rejoin");
        await tx
          .update(memberships)
          .set({
            status: "PENDING",
            isHome: !hasHome,
            requestedAt: new Date(),
            decidedAt: null,
            decidedByMemberId: null,
            decisionNote: null,
          })
          .where(eq(memberships.id, prior.id));
      } else {
        await tx
          .insert(memberships)
          .values({ memberId, groupId, roleId: role.id, status: "PENDING", isHome: !hasHome });
      }
      await tx.insert(follows).values({ memberId, groupId }).onConflictDoNothing();
    });

    const [p] = await this.db
      .select({ f: members.firstName, l: members.lastName })
      .from(members)
      .where(eq(members.id, memberId));
    await this.churches.notifyApprovers(
      church,
      `${p?.f ?? "Someone"} ${p?.l ?? ""} asked to join ${church.name}`.trim(),
      `/admin/members/requests?church=${church.id}&highlight=${memberId}`,
    );
    await this.audit.write({
      actorType: "MEMBER",
      actorId: memberId,
      groupId,
      action: "membership.requested",
      ip,
    });
    const mine = await this.myMemberships(memberId);
    return mine.find((m) => m.church.id === groupId)!;
  }

  async leave(memberId: string, groupId: string, ip: string): Promise<void> {
    const [m] = await this.db
      .select({ id: memberships.id, status: memberships.status })
      .from(memberships)
      .where(and(eq(memberships.memberId, memberId), eq(memberships.groupId, groupId)))
      .limit(1);
    if (!m) throw notFound();
    try {
      nextMembershipStatus(m.status, "leave");
    } catch (e) {
      if (e instanceof InvalidMembershipTransition) throw notFound();
      throw e;
    }
    // Leaving the home church clears it; the person can transfer or join again (D-016).
    // A request to move the home here can no longer be approved, so it is cancelled (D-049).
    await this.db.transaction(async (tx) => {
      await tx
        .update(memberships)
        .set({ status: "LEFT", isHome: false })
        .where(eq(memberships.id, m.id));
      await tx
        .update(homeTransfers)
        .set({ status: "CANCELLED", decidedAt: new Date() })
        .where(
          and(
            eq(homeTransfers.memberId, memberId),
            eq(homeTransfers.toGroupId, groupId),
            eq(homeTransfers.status, "PENDING"),
          ),
        );
    });
    await this.audit.write({
      actorType: "MEMBER",
      actorId: memberId,
      groupId,
      action: "membership.left",
      entityType: "membership",
      entityId: m.id,
      ip,
    });
  }

  // ------------------------------------------------------------------ follow
  async follow(memberId: string, groupId: string) {
    const [g] = await this.db
      .select({ id: groups.id })
      .from(groups)
      .where(and(eq(groups.id, groupId), eq(groups.isActive, true)))
      .limit(1);
    if (!g) throw new DomainError(404, "CHURCH_NOT_FOUND", "That church doesn't exist.");
    await this.db.insert(follows).values({ memberId, groupId }).onConflictDoNothing();
  }

  async unfollow(memberId: string, groupId: string) {
    await this.db
      .delete(follows)
      .where(and(eq(follows.memberId, memberId), eq(follows.groupId, groupId)));
  }

  // ------------------------------------------------------------------ approvals
  async pendingFor(deciderId: string, groupId: string): Promise<MembershipRequest[]> {
    if (!(await this.scopes.canDecideMembership(deciderId, groupId))) throw notAllowed();
    const rows = await this.db
      .select({
        id: memberships.id,
        isHome: memberships.isHome,
        requestedAt: memberships.requestedAt,
        person: {
          id: members.id,
          firstName: members.firstName,
          lastName: members.lastName,
          email: members.email,
          telephone: members.telephone,
        },
        church: { id: groups.id, name: groups.name, level: groups.level },
      })
      .from(memberships)
      .innerJoin(members, eq(memberships.memberId, members.id))
      .innerJoin(groups, eq(memberships.groupId, groups.id))
      .where(and(eq(memberships.groupId, groupId), eq(memberships.status, "PENDING")))
      .orderBy(asc(memberships.requestedAt));
    return rows.map((r) => ({ ...r, requestedAt: r.requestedAt.toISOString() }));
  }

  async decide(deciderId: string, membershipId: string, d: MembershipDecision, ip: string) {
    const [m] = await this.db
      .select({
        id: memberships.id,
        status: memberships.status,
        groupId: memberships.groupId,
        memberId: memberships.memberId,
      })
      .from(memberships)
      .where(eq(memberships.id, membershipId))
      .limit(1);
    if (!m) throw notFound();
    if (!(await this.scopes.canDecideMembership(deciderId, m.groupId))) throw notAllowed();
    let to: ReturnType<typeof nextMembershipStatus>;
    try {
      to = nextMembershipStatus(m.status, d.decision);
    } catch {
      throw new DomainError(409, "INVALID_TRANSITION", "This request has already been decided.");
    }
    await this.db
      .update(memberships)
      .set({
        status: to,
        decidedAt: new Date(),
        decidedByMemberId: deciderId,
        decisionNote: d.note ?? null,
        ...(to === "REJECTED" ? { isHome: false } : {}),
      })
      .where(eq(memberships.id, m.id));

    const [church] = await this.db
      .select({ name: groups.name })
      .from(groups)
      .where(eq(groups.id, m.groupId));
    await this.notifyPerson(
      m.memberId,
      m.groupId,
      to === "ACTIVE"
        ? `${church?.name ?? "Your church"} approved your membership`
        : `${church?.name ?? "Your church"} declined your request`,
      d.note,
    );
    await this.audit.write({
      actorType: "MEMBER",
      actorId: deciderId,
      groupId: m.groupId,
      action: `membership.${d.decision}`,
      entityType: "membership",
      entityId: m.id,
      metadata: { applicant: m.memberId },
      ip,
    });
    return { id: m.id, status: to };
  }

  // ------------------------------------------------------------------ home transfers (D-016, D-049)
  private async openTransfer(memberId: string): Promise<MyHomeTransfer | null> {
    const [t] = await this.db
      .select({
        id: homeTransfers.id,
        requestedAt: homeTransfers.createdAt,
        from: { id: fromGroups.id, name: fromGroups.name, level: fromGroups.level },
        to: { id: toGroups.id, name: toGroups.name, level: toGroups.level },
      })
      .from(homeTransfers)
      .innerJoin(toGroups, eq(homeTransfers.toGroupId, toGroups.id))
      .leftJoin(fromGroups, eq(homeTransfers.fromGroupId, fromGroups.id))
      .where(and(eq(homeTransfers.memberId, memberId), eq(homeTransfers.status, "PENDING")))
      .limit(1);
    if (!t) return null;
    return {
      id: t.id,
      from: t.from?.id ? t.from : null,
      to: t.to,
      requestedAt: t.requestedAt.toISOString(),
    };
  }

  /** Ask to make `toGroupId` (where the person is ACTIVE) their home church. */
  async requestTransfer(
    memberId: string,
    toGroupId: string,
    reason: string | undefined,
    ip: string,
  ): Promise<MyHomeTransfer> {
    const mine = await this.db
      .select({
        groupId: memberships.groupId,
        status: memberships.status,
        isHome: memberships.isHome,
      })
      .from(memberships)
      .where(eq(memberships.memberId, memberId));
    const blocker = homeTransferBlocker(mine, toGroupId);
    if (blocker) throw new DomainError(409, blocker, BLOCKER_MESSAGE[blocker] ?? blocker);
    if (await this.openTransfer(memberId))
      throw new DomainError(
        409,
        "TRANSFER_PENDING",
        "You already have a home-church request waiting. Cancel it first.",
      );
    const church = await this.churches.findJoinable(toGroupId);
    if (!church)
      throw new DomainError(404, "CHURCH_NOT_FOUND", "That church isn't available.");
    const from = mine.find((m) => m.isHome && m.status === "ACTIVE")?.groupId ?? null;

    try {
      await this.db
        .insert(homeTransfers)
        .values({ memberId, fromGroupId: from, toGroupId, reason: reason ?? null });
    } catch (e) {
      // home_transfers_one_open_uq: a parallel request won the race. Newer drizzle versions wrap
      // the driver error, so look at the cause too.
      const pg = e as { code?: string; cause?: { code?: string } };
      if (pg.code === "23505" || pg.cause?.code === "23505")
        throw new DomainError(409, "TRANSFER_PENDING", "You already have a home-church request waiting.");
      throw e;
    }

    const [p] = await this.db
      .select({ f: members.firstName, l: members.lastName })
      .from(members)
      .where(eq(members.id, memberId));
    await this.churches.notifyApprovers(
      church,
      `${p?.f ?? "Someone"} ${p?.l ?? ""} asked to make ${church.name} their home church`.trim(),
      `/admin/members/requests?church=${church.id}`,
    );
    await this.audit.write({
      actorType: "MEMBER",
      actorId: memberId,
      groupId: toGroupId,
      action: "home_transfer.requested",
      metadata: { from },
      ip,
    });
    return (await this.openTransfer(memberId))!;
  }

  async cancelTransfer(memberId: string, ip: string): Promise<void> {
    const open = await this.openTransfer(memberId);
    if (!open) throw transferNotFound();
    await this.db
      .update(homeTransfers)
      .set({ status: "CANCELLED", decidedAt: new Date() })
      .where(and(eq(homeTransfers.id, open.id), eq(homeTransfers.status, "PENDING")));
    await this.audit.write({
      actorType: "MEMBER",
      actorId: memberId,
      groupId: open.to.id,
      action: "home_transfer.cancelled",
      entityType: "home_transfer",
      entityId: open.id,
      ip,
    });
  }

  /** Open requests to move a home INTO `groupId` — same approvers as joining (D-016). */
  async transfersFor(deciderId: string, groupId: string): Promise<HomeTransferRequest[]> {
    if (!(await this.scopes.canDecideMembership(deciderId, groupId))) throw notAllowed();
    const rows = await this.db
      .select({
        id: homeTransfers.id,
        reason: homeTransfers.reason,
        requestedAt: homeTransfers.createdAt,
        person: {
          id: members.id,
          firstName: members.firstName,
          lastName: members.lastName,
          email: members.email,
          telephone: members.telephone,
        },
        from: { id: fromGroups.id, name: fromGroups.name, level: fromGroups.level },
        to: { id: toGroups.id, name: toGroups.name, level: toGroups.level },
      })
      .from(homeTransfers)
      .innerJoin(members, eq(homeTransfers.memberId, members.id))
      .innerJoin(toGroups, eq(homeTransfers.toGroupId, toGroups.id))
      .leftJoin(fromGroups, eq(homeTransfers.fromGroupId, fromGroups.id))
      .where(and(eq(homeTransfers.toGroupId, groupId), eq(homeTransfers.status, "PENDING")))
      .orderBy(asc(homeTransfers.createdAt));
    return rows.map((r) => ({
      ...r,
      from: r.from?.id ? r.from : null,
      requestedAt: r.requestedAt.toISOString(),
    }));
  }

  async decideTransfer(deciderId: string, id: string, d: MembershipDecision, ip: string) {
    const [t] = await this.db
      .select({
        id: homeTransfers.id,
        status: homeTransfers.status,
        memberId: homeTransfers.memberId,
        fromGroupId: homeTransfers.fromGroupId,
        toGroupId: homeTransfers.toGroupId,
      })
      .from(homeTransfers)
      .where(eq(homeTransfers.id, id))
      .limit(1);
    if (!t) throw transferNotFound();
    if (!(await this.scopes.canDecideMembership(deciderId, t.toGroupId))) throw notAllowed();
    const to = nextHomeTransferStatus(t.status, d.decision);
    if (!to)
      throw new DomainError(409, "INVALID_TRANSITION", "This request has already been decided.");

    await this.db.transaction(async (tx) => {
      if (to === "APPROVED") {
        // The person may have left the church since asking.
        const [target] = await tx
          .select({ id: memberships.id, status: memberships.status })
          .from(memberships)
          .where(and(eq(memberships.memberId, t.memberId), eq(memberships.groupId, t.toGroupId)))
          .limit(1);
        if (target?.status !== "ACTIVE")
          throw new DomainError(
            409,
            "NOT_AN_ACTIVE_MEMBER",
            "This person is no longer an active member here.",
          );
        // One home per person (memberships_one_home_uq): clear the old home first.
        await tx
          .update(memberships)
          .set({ isHome: false })
          .where(
            and(
              eq(memberships.memberId, t.memberId),
              eq(memberships.isHome, true),
              ne(memberships.id, target.id),
            ),
          );
        await tx.update(memberships).set({ isHome: true }).where(eq(memberships.id, target.id));
      }
      await tx
        .update(homeTransfers)
        .set({
          status: to,
          decidedByMemberId: deciderId,
          decidedAt: new Date(),
          decisionNote: d.note ?? null,
        })
        .where(and(eq(homeTransfers.id, t.id), eq(homeTransfers.status, "PENDING")));
    });

    const [toChurch] = await this.db
      .select({ name: groups.name })
      .from(groups)
      .where(eq(groups.id, t.toGroupId));
    await this.notifyPerson(
      t.memberId,
      t.toGroupId,
      to === "APPROVED"
        ? `${toChurch?.name ?? "Your church"} is now your home church`
        : `${toChurch?.name ?? "The church"} declined your home-church request`,
      d.note,
    );
    // The previous home is told it no longer keeps this person's records (D-016).
    if (to === "APPROVED" && t.fromGroupId) {
      const prev = await this.churches.findJoinable(t.fromGroupId);
      const [p] = await this.db
        .select({ f: members.firstName, l: members.lastName })
        .from(members)
        .where(eq(members.id, t.memberId));
      if (prev)
        await this.churches.notifyApprovers(
          prev,
          `${p?.f ?? "A member"} ${p?.l ?? ""} moved their home church to ${toChurch?.name ?? "another church"}`.trim(),
          `/admin/members/${t.memberId}`,
        );
    }
    await this.audit.write({
      actorType: "MEMBER",
      actorId: deciderId,
      groupId: t.toGroupId,
      action: `home_transfer.${d.decision}`,
      entityType: "home_transfer",
      entityId: t.id,
      metadata: { member: t.memberId, from: t.fromGroupId },
      ip,
    });
    return { id: t.id, status: to };
  }

  private notifyPerson(memberId: string, groupId: string, title: string, body?: string) {
    return this.notify.people("SYSTEM", { memberIds: [memberId] }, { title, body, link: "/me" }, groupId);
  }
}
