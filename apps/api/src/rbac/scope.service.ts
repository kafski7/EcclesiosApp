import { Inject, Injectable } from "@nestjs/common";
import { groupSettings, groups, memberships, roles } from "@ecclesios/db";
import {
  canDecideMembership,
  pathIds,
  resolveMemberAccess,
  type GroupNode,
  type MemberAccess,
  type MembershipNode,
} from "@ecclesios/shared/domain";
import { eq, inArray } from "drizzle-orm";
import { DB, type Database } from "../db/db.module";

export interface PersonScope {
  memberships: MembershipNode[];
  target: GroupNode | undefined;
  lookup: (id: string) => GroupNode | undefined;
}

/**
 * Loads a person's ACTIVE memberships plus every group needed to judge a target
 * (target path + each membership's group) in two queries, then lets the pure
 * functions in @ecclesios/shared decide (D-005, D-015).
 */
@Injectable()
export class ScopeService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async load(memberId: string, targetGroupId: string): Promise<PersonScope> {
    const mine = await this.db
      .select({ groupId: memberships.groupId, role: roles.code, status: memberships.status })
      .from(memberships)
      .innerJoin(roles, eq(memberships.roleId, roles.id))
      .where(eq(memberships.memberId, memberId));
    const live = mine.filter((m) => m.status === "ACTIVE");

    const [target] = await this.db
      .select({ path: groups.path })
      .from(groups)
      .where(eq(groups.id, targetGroupId))
      .limit(1);
    const ids = [
      ...new Set([...(target ? pathIds(target.path) : []), ...live.map((m) => m.groupId)]),
    ];
    const rows = ids.length
      ? await this.db
          .select({
            id: groups.id,
            level: groups.level,
            path: groups.path,
            vis: groupSettings.metropolitanVisibility,
          })
          .from(groups)
          .leftJoin(groupSettings, eq(groupSettings.groupId, groups.id))
          .where(inArray(groups.id, ids))
      : [];
    const nodes = new Map<string, GroupNode>(
      rows.map((r) => [
        r.id,
        { id: r.id, level: r.level, path: r.path, metropolitanVisibility: r.vis ?? undefined },
      ]),
    );
    return {
      memberships: live.flatMap((m) => {
        const group = nodes.get(m.groupId);
        return group ? [{ group, role: m.role, status: m.status }] : [];
      }),
      target: nodes.get(targetGroupId),
      lookup: (id) => nodes.get(id),
    };
  }

  async resolve(memberId: string, targetGroupId: string): Promise<MemberAccess[]> {
    const s = await this.load(memberId, targetGroupId);
    if (!s.target) return [];
    try {
      return resolveMemberAccess(s.memberships, s.target, s.lookup);
    } catch {
      return []; // fail closed (e.g. inconsistent path)
    }
  }

  async canDecideMembership(memberId: string, targetGroupId: string): Promise<boolean> {
    const s = await this.load(memberId, targetGroupId);
    if (!s.target) return false;
    try {
      return canDecideMembership(s.memberships, s.target, s.lookup);
    } catch {
      return false;
    }
  }
}
