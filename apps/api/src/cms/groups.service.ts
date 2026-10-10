import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { groups, members, memberships, roles } from "@ecclesios/db";
import type {
  CreateGroupSchema,
  GroupChild,
  GroupList,
  UpdateGroupSchema,
} from "@ecclesios/shared";
import { buildPath, childLevelFor, closeBlocker, isValidParent } from "@ecclesios/shared/domain";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { z } from "zod";
import { AuditService } from "../audit/audit.service";
import { DomainError } from "../auth/core/errors";
import { DB, type Database } from "../db/db.module";
import { ScopeService } from "../rbac/scope.service";
import { ChurchService } from "./church.service";

type Create = z.output<typeof CreateGroupSchema>;
type Update = z.output<typeof UpdateGroupSchema>;

const codeTaken = (e: unknown) =>
  typeof e === "object" && e !== null && (e as { code?: string }).code === "23505";

/**
 * Groups in Church Management (functionality §4.13, D-041): the groups directly under this one,
 * with counts the viewer may see; Administrators open, rename, close and reopen them.
 */
@Injectable()
export class GroupsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly scopes: ScopeService,
    private readonly church: ChurchService,
    private readonly audit: AuditService,
  ) {}

  private async group(id: string) {
    const [g] = await this.db.select().from(groups).where(eq(groups.id, id)).limit(1);
    if (!g) throw new DomainError(404, "NOT_FOUND", "We couldn't find that church.");
    return g;
  }

  async children(actorId: string, groupId: string): Promise<GroupList> {
    const g = await this.group(groupId);
    const kids = await this.db
      .select()
      .from(groups)
      .where(eq(groups.parentGroupId, groupId))
      .orderBy(asc(groups.name));
    const { nodes } = await this.scopes.visibleWithin(actorId, groupId);
    const visible = new Set(nodes.map((n) => n.id));
    const ids = kids.map((k) => k.id);
    const [counts, grandkids] = ids.length
      ? await Promise.all([
          this.db
            .select({ id: memberships.groupId, n: sql<number>`count(*)::int` })
            .from(memberships)
            .where(and(inArray(memberships.groupId, ids), eq(memberships.status, "ACTIVE")))
            .groupBy(memberships.groupId),
          this.db
            .select({ id: groups.parentGroupId, n: sql<number>`count(*)::int` })
            .from(groups)
            .where(and(inArray(groups.parentGroupId, ids), eq(groups.isActive, true)))
            .groupBy(groups.parentGroupId),
        ])
      : [[], []];
    const items: GroupChild[] = kids.map((k) => {
      const hidden = !visible.has(k.id);
      return {
        id: k.id,
        name: k.name,
        code: k.code,
        level: k.level,
        isActive: k.isActive,
        members: hidden ? 0 : (counts.find((c) => c.id === k.id)?.n ?? 0),
        openChildren: hidden ? 0 : (grandkids.find((c) => c.id === k.id)?.n ?? 0),
        hidden,
      };
    });
    const childLevel = childLevelFor(g.level);
    return {
      group: { id: g.id, name: g.name, level: g.level },
      childLevel,
      canManage: !!childLevel && (await this.church.isAdministratorOf(actorId, groupId)),
      items,
    };
  }

  private async assertAdmin(actorId: string, groupId: string) {
    if (!(await this.church.isAdministratorOf(actorId, groupId)))
      throw new DomainError(
        403,
        "NOT_ALLOWED",
        "Only this church's Administrators can manage the groups under it.",
      );
  }

  async create(actorId: string, parentId: string, b: Create, ip: string) {
    await this.assertAdmin(actorId, parentId);
    const parent = await this.group(parentId);
    const level = childLevelFor(parent.level);
    if (!level || !isValidParent(level, parent.level))
      throw new DomainError(
        400,
        "NOT_ALLOWED_HERE",
        "New groups at this level are opened on the Ecclesios platform.",
      );
    if (!parent.isActive)
      throw new DomainError(409, "CLOSED", "Reopen this church before adding groups under it.");
    let admin: { roleId: number } | null = null;
    if (b.administratorPersonId) {
      const [m] = await this.db
        .select({ id: memberships.id })
        .from(memberships)
        .innerJoin(members, eq(members.id, memberships.memberId))
        .where(
          and(
            eq(memberships.memberId, b.administratorPersonId),
            eq(memberships.groupId, parentId),
            eq(memberships.status, "ACTIVE"),
            eq(members.isDeceased, false),
          ),
        )
        .limit(1);
      if (!m)
        throw new DomainError(
          400,
          "NOT_A_MEMBER",
          "The new group's Administrator must be an active member of this church.",
        );
      const [r] = await this.db
        .select({ id: roles.id })
        .from(roles)
        .where(eq(roles.code, "ADMINISTRATOR"))
        .limit(1);
      admin = { roleId: r!.id };
    }
    const id = randomUUID();
    try {
      await this.db.transaction(async (tx) => {
        await tx.insert(groups).values({
          id,
          parentGroupId: parentId,
          level,
          name: b.name,
          code: b.code,
          path: buildPath(parent.path, id),
          themeId: parent.themeId,
          currencyCode: parent.currencyCode,
          languageCode: parent.languageCode,
        });
        if (admin && b.administratorPersonId)
          await tx.insert(memberships).values({
            memberId: b.administratorPersonId,
            groupId: id,
            roleId: admin.roleId,
            status: "ACTIVE",
            isHome: false,
            decidedByMemberId: actorId,
            decidedAt: new Date(),
          });
      });
    } catch (e) {
      if (codeTaken(e))
        throw new DomainError(409, "CODE_TAKEN", "Another church already uses that code.");
      throw e;
    }
    await this.audit.write({
      actorType: "MEMBER",
      actorId,
      groupId: parentId,
      action: "group.created",
      entityType: "group",
      entityId: id,
      metadata: { name: b.name, level, administrator: b.administratorPersonId },
      ip,
    });
    return this.children(actorId, parentId);
  }

  private async childOf(parentId: string, childId: string) {
    const c = await this.group(childId);
    if (c.parentGroupId !== parentId)
      throw new DomainError(404, "NOT_FOUND", "That group isn't under this church.");
    return c;
  }

  async update(actorId: string, parentId: string, childId: string, b: Update, ip: string) {
    await this.assertAdmin(actorId, parentId);
    await this.childOf(parentId, childId);
    try {
      await this.db
        .update(groups)
        .set({ name: b.name, code: b.code, updatedAt: new Date() })
        .where(eq(groups.id, childId));
    } catch (e) {
      if (codeTaken(e))
        throw new DomainError(409, "CODE_TAKEN", "Another church already uses that code.");
      throw e;
    }
    await this.audit.write({
      actorType: "MEMBER",
      actorId,
      groupId: parentId,
      action: "group.updated",
      entityType: "group",
      entityId: childId,
      metadata: { ...b },
      ip,
    });
    return this.children(actorId, parentId);
  }

  /** Close (hidden from sign-up and joining; records kept) or reopen. */
  async setActive(
    actorId: string,
    parentId: string,
    childId: string,
    isActive: boolean,
    ip: string,
  ) {
    await this.assertAdmin(actorId, parentId);
    await this.childOf(parentId, childId);
    if (!isActive) {
      const open = await this.db
        .select({ n: sql<number>`count(*)::int` })
        .from(groups)
        .where(and(eq(groups.parentGroupId, childId), eq(groups.isActive, true)));
      if (closeBlocker({ activeChildren: open[0]?.n ?? 0 }))
        throw new DomainError(409, "HAS_OPEN_CHILDREN", "Close the groups under it first.");
    }
    await this.db
      .update(groups)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(groups.id, childId));
    await this.audit.write({
      actorType: "MEMBER",
      actorId,
      groupId: parentId,
      action: isActive ? "group.reopened" : "group.closed",
      entityType: "group",
      entityId: childId,
      ip,
    });
    return this.children(actorId, parentId);
  }
}
