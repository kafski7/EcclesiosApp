import { Inject, Injectable } from "@nestjs/common";
import {
  groupSettings,
  groups,
  members,
  memberships,
  roles,
  societies,
  societyMembers,
} from "@ecclesios/db";
import {
  BROADCAST_LEVELS,
  BROADCAST_STAFF_ROLES,
  daysUntilBirthday,
  descendantsLikePattern,
  inBroadcastReach,
  type Audience,
  type GroupNode,
  type HierarchyLevel,
} from "@ecclesios/shared";
import { and, asc, eq, inArray, like, sql, type SQL } from "drizzle-orm";
import { DomainError } from "../auth/core/errors";
import { DB, type Database } from "../db/db.module";

export interface Sender extends GroupNode {
  name: string;
}

/** One person a message reaches, with what every channel needs. */
export interface Recipient {
  memberId: string;
  firstName: string;
  name: string;
  groupId: string;
  church: string;
  telephone: string | null;
  email: string | null;
  usesApp: boolean;
}

const LEVEL_PLURAL: Record<HierarchyLevel, string> = {
  VATICAN: "Vatican",
  NUNCIATURE: "nunciatures",
  PROVINCE: "provinces",
  ARCHDIOCESE: "archdioceses",
  DIOCESE: "dioceses",
  DEANERY: "deaneries",
  PARISH: "parishes",
  OUTSTATION: "outstations",
};

interface PersonRow {
  memberId: string;
  firstName: string;
  lastName: string;
  telephone: string | null;
  email: string | null;
  dateOfBirth: string | null;
  usesApp: boolean;
  groupId: string;
  church: string;
}

const joinWords = (xs: string[]) =>
  xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`;

/**
 * Turns an audience into people (functionality §4.7, blueprint §3.3; D-051).
 * Only ACTIVE memberships of living, active accounts count; each person once.
 * Own-church audiences stay in the sender's church (a parish may add its outstations);
 * broadcasts follow `inBroadcastReach` (never into a suffragan diocese from the archdiocese).
 */
@Injectable()
export class AudienceResolver {
  constructor(@Inject(DB) private readonly db: Database) {}

  async sender(groupId: string): Promise<Sender> {
    const [g] = await this.db
      .select({
        id: groups.id,
        name: groups.name,
        level: groups.level,
        path: groups.path,
        vis: groupSettings.metropolitanVisibility,
      })
      .from(groups)
      .leftJoin(groupSettings, eq(groupSettings.groupId, groups.id))
      .where(eq(groups.id, groupId))
      .limit(1);
    if (!g) throw new DomainError(404, "GROUP_NOT_FOUND", "We couldn't find that church.");
    return {
      id: g.id,
      name: g.name,
      level: g.level,
      path: g.path,
      metropolitanVisibility: g.vis ?? undefined,
    };
  }

  /** The church plus, for a parish that asks, its open outstations. */
  async ownChurches(sender: Sender, includeOutstations: boolean): Promise<string[]> {
    if (!includeOutstations || sender.level !== "PARISH") return [sender.id];
    const kids = await this.db
      .select({ id: groups.id })
      .from(groups)
      .where(
        and(
          eq(groups.parentGroupId, sender.id),
          eq(groups.level, "OUTSTATION"),
          eq(groups.isActive, true),
        ),
      );
    return [sender.id, ...kids.map((k) => k.id)];
  }

  /** Open groups below the sender a broadcast can reach, per level. */
  async broadcastTargets(sender: Sender, levels: readonly HierarchyLevel[]) {
    const rows = await this.db
      .select({
        id: groups.id,
        name: groups.name,
        level: groups.level,
        path: groups.path,
        isActive: groups.isActive,
        vis: groupSettings.metropolitanVisibility,
      })
      .from(groups)
      .leftJoin(groupSettings, eq(groupSettings.groupId, groups.id))
      .where(like(groups.path, descendantsLikePattern(sender.path)));
    const nodes = new Map<string, GroupNode>(
      rows.map((r) => [
        r.id,
        { id: r.id, level: r.level, path: r.path, metropolitanVisibility: r.vis ?? undefined },
      ]),
    );
    const lookup = (id: string) => (id === sender.id ? sender : nodes.get(id));
    return rows.filter(
      (r) => r.isActive && inBroadcastReach(sender, nodes.get(r.id)!, levels, lookup),
    );
  }

  /** Every level that has at least one reachable group (for the compose screen). */
  async presentBroadcastLevels(sender: Sender): Promise<HierarchyLevel[]> {
    const allowed = BROADCAST_LEVELS[sender.level];
    if (!allowed.length) return [];
    const reach = await this.broadcastTargets(sender, allowed);
    return allowed.filter((l) => reach.some((r) => r.level === l));
  }

  private people(where: SQL[]): Promise<PersonRow[]> {
    return this.db
      .selectDistinctOn([members.id], {
        memberId: members.id,
        firstName: members.firstName,
        lastName: members.lastName,
        telephone: members.telephone,
        email: members.email,
        dateOfBirth: members.dateOfBirth,
        usesApp: sql<boolean>`${members.passwordHash} is not null`,
        groupId: groups.id,
        church: groups.name,
      })
      .from(memberships)
      .innerJoin(members, eq(members.id, memberships.memberId))
      .innerJoin(groups, eq(groups.id, memberships.groupId))
      .innerJoin(roles, eq(roles.id, memberships.roleId))
      .where(
        and(
          eq(memberships.status, "ACTIVE"),
          eq(members.isActive, true),
          eq(members.isDeceased, false),
          ...where,
        ),
      )
      .orderBy(members.id, asc(groups.path));
  }

  async resolve(sender: Sender, audience: Audience, today: string): Promise<Recipient[]> {
    let rows: PersonRow[] = [];
    switch (audience.kind) {
      case "CHURCH":
      case "BIRTHDAYS_TODAY": {
        const ids = await this.ownChurches(sender, audience.includeOutstations);
        rows = await this.people([inArray(memberships.groupId, ids)]);
        if (audience.kind === "BIRTHDAYS_TODAY")
          rows = rows.filter((r) => r.dateOfBirth && daysUntilBirthday(r.dateOfBirth, today) === 0);
        break;
      }
      case "PEOPLE": {
        const ids = await this.ownChurches(sender, true);
        rows = await this.people([
          inArray(memberships.groupId, ids),
          inArray(members.id, audience.ids),
        ]);
        break;
      }
      case "SOCIETIES": {
        const soc = await this.db
          .select({ id: societies.id })
          .from(societies)
          .where(
            and(
              inArray(societies.id, audience.ids),
              eq(societies.groupId, sender.id),
              eq(societies.isActive, true),
            ),
          );
        if (!soc.length) return [];
        // Roster people may belong through an outstation (D-038): any of their active memberships
        // under this church counts; they are reached "through" this church.
        const ids = await this.ownChurches(sender, true);
        rows = await this.people([
          inArray(memberships.groupId, ids),
          inArray(
            members.id,
            this.db
              .select({ id: societyMembers.memberId })
              .from(societyMembers)
              .where(
                inArray(
                  societyMembers.societyId,
                  soc.map((s) => s.id),
                ),
              ),
          ),
        ]);
        break;
      }
      case "BROADCAST": {
        const allowed = BROADCAST_LEVELS[sender.level];
        const bad = audience.levels.filter((l) => !allowed.includes(l));
        if (!allowed.length || bad.length)
          throw new DomainError(
            403,
            "BROADCAST_NOT_ALLOWED",
            allowed.length
              ? `This church can't broadcast to ${joinWords(bad.map((l) => LEVEL_PLURAL[l]))}.`
              : "This church has no churches below it to broadcast to.",
          );
        const targets = await this.broadcastTargets(sender, audience.levels);
        if (!targets.length) return [];
        const where: SQL[] = [
          inArray(
            memberships.groupId,
            targets.map((t) => t.id),
          ),
        ];
        if (audience.people === "STAFF") where.push(inArray(roles.code, [...BROADCAST_STAFF_ROLES]));
        rows = await this.people(where);
        break;
      }
    }
    return rows.map((r) => ({
      memberId: r.memberId,
      firstName: r.firstName,
      name: `${r.firstName} ${r.lastName}`,
      groupId: r.groupId,
      church: r.church,
      telephone: r.telephone,
      email: r.email,
      usesApp: r.usesApp,
    }));
  }

  /** Human label for the log ("Everyone at St Theresa Parish and its outstations"). */
  async label(sender: Sender, a: Audience): Promise<string> {
    switch (a.kind) {
      case "CHURCH":
        return `Everyone at ${sender.name}${a.includeOutstations && sender.level === "PARISH" ? " and its outstations" : ""}`;
      case "BIRTHDAYS_TODAY":
        return `Today's birthdays at ${sender.name}${a.includeOutstations && sender.level === "PARISH" ? " and its outstations" : ""}`;
      case "PEOPLE":
        return `${a.ids.length} ${a.ids.length === 1 ? "person" : "people"} chosen`;
      case "SOCIETIES": {
        const names = (
          await this.db
            .select({ name: societies.name })
            .from(societies)
            .where(and(inArray(societies.id, a.ids), eq(societies.groupId, sender.id)))
            .orderBy(asc(societies.name))
        ).map((s) => s.name);
        const shown = names.slice(0, 3);
        const rest = names.length - shown.length;
        return (rest > 0 ? `${shown.join(", ")} +${rest}` : joinWords(shown)).slice(0, 200) || "Societies";
      }
      case "BROADCAST": {
        const who = a.people === "STAFF" ? "Staff of" : "Everyone in";
        return `${who} ${joinWords(a.levels.map((l) => LEVEL_PLURAL[l]))} under ${sender.name}`.slice(0, 200);
      }
    }
  }
}
