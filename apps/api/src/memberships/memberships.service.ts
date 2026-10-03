import { Inject, Injectable } from "@nestjs/common";
import {
  follows,
  groups,
  memberPrivileges,
  members,
  memberships,
  notificationTypes,
  notifications,
  roles,
} from "@ecclesios/db";
import type {
  MeResponse,
  MembershipDecision,
  MembershipRequest,
  MyMembership,
} from "@ecclesios/shared";
import { InvalidMembershipTransition, nextMembershipStatus } from "@ecclesios/shared/domain";
import { and, asc, eq } from "drizzle-orm";
import { AuditService } from "../audit/audit.service";
import { DomainError } from "../auth/core/errors";
import { DB, type Database } from "../db/db.module";
import { ScopeService } from "../rbac/scope.service";
import { ChurchesService } from "./churches.service";

const notFound = () =>
  new DomainError(404, "MEMBERSHIP_NOT_FOUND", "That membership request no longer exists.");
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
  ) {}

  // ------------------------------------------------------------------ me
  async me(memberId: string): Promise<MeResponse> {
    const [p] = await this.db.select().from(members).where(eq(members.id, memberId)).limit(1);
    if (!p) throw new DomainError(404, "NOT_FOUND", "Account not found.");
    const [mine, followed, grants] = await Promise.all([
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
    await this.db
      .update(memberships)
      .set({ status: "LEFT", isHome: false })
      .where(eq(memberships.id, m.id));
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

  private async notifyPerson(memberId: string, groupId: string, title: string, body?: string) {
    const [type] = await this.db
      .select({ id: notificationTypes.id })
      .from(notificationTypes)
      .where(eq(notificationTypes.code, "SYSTEM"))
      .limit(1);
    if (!type) return;
    await this.db
      .insert(notifications)
      .values({
        typeId: type.id,
        groupId,
        recipientMemberId: memberId,
        title,
        body: body ?? null,
        link: "/me",
      });
  }
}
