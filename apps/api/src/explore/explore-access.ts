import { Inject, Injectable } from "@nestjs/common";
import { groups, memberPrivileges, memberships, roles, userPrivileges } from "@ecclesios/db";
import type { Principal } from "@ecclesios/shared";
import type { ExploreActor, MembershipNode } from "@ecclesios/shared/domain";
import { and, eq } from "drizzle-orm";
import { DB, type Database } from "../db/db.module";

export type Actor = ExploreActor & { id: string };

/** Loads what the Explore rules need about the caller: grants and ACTIVE memberships (D-015, D-017). */
@Injectable()
export class ExploreAccess {
  constructor(@Inject(DB) private readonly db: Database) {}

  async actor(p: Principal): Promise<Actor> {
    if (p.kind === "user") {
      const rows = await this.db
        .select({ privilege: userPrivileges.privilege })
        .from(userPrivileges)
        .where(eq(userPrivileges.userId, p.id));
      return { kind: "user", id: p.id, role: p.role, privileges: rows.map((r) => r.privilege) };
    }
    const [grants, mine] = await Promise.all([
      this.db.select({ privilege: memberPrivileges.privilege }).from(memberPrivileges).where(eq(memberPrivileges.memberId, p.id)),
      this.db
        .select({ id: groups.id, level: groups.level, path: groups.path, name: groups.name, role: roles.code })
        .from(memberships)
        .innerJoin(groups, eq(groups.id, memberships.groupId))
        .innerJoin(roles, eq(roles.id, memberships.roleId))
        .where(and(eq(memberships.memberId, p.id), eq(memberships.status, "ACTIVE"), eq(groups.isActive, true))),
    ]);
    const nodes: MembershipNode[] = mine.map((m) => ({
      group: { id: m.id, level: m.level, path: m.path },
      role: m.role,
      status: "ACTIVE",
    }));
    return { kind: "member", id: p.id, privileges: grants.map((g) => g.privilege), memberships: nodes };
  }

  /** Churches the member administers (where they may post in the church's name). */
  async administeredChurches(memberId: string) {
    return this.db
      .select({ id: groups.id, name: groups.name })
      .from(memberships)
      .innerJoin(groups, eq(groups.id, memberships.groupId))
      .innerJoin(roles, eq(roles.id, memberships.roleId))
      .where(
        and(
          eq(memberships.memberId, memberId),
          eq(memberships.status, "ACTIVE"),
          eq(roles.code, "ADMINISTRATOR"),
          eq(groups.isActive, true),
        ),
      )
      .orderBy(groups.name);
  }
}
