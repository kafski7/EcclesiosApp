import { describe, expect, it } from "vitest";
import { resolveAccess, type GroupNode } from "@ecclesios/shared/domain";
import * as d from "./data";

describe("dev seed data", () => {
  const groups = d.resolveGroups();

  it("is a valid hierarchy (parents first, allowed parent levels)", () => {
    expect(groups.size).toBe(d.GROUPS.length);
  });

  it("matches todo Phase 1 shape: province → metropolitan archdiocese → suffragan → 2 deaneries → 3 parishes → outstations", () => {
    const count = (level: string, parent?: string) =>
      [...groups.values()].filter((g) => g.level === level && (!parent || g.parentKey === parent))
        .length;
    expect(count("PROVINCE")).toBe(1);
    expect(count("ARCHDIOCESE")).toBe(1);
    expect(count("DIOCESE", "arch")).toBe(1);
    expect(count("DEANERY", "dio")).toBe(2);
    expect(
      [...groups.values()].filter((g) => g.level === "PARISH" && g.path.includes(d.seedId(104)))
        .length,
    ).toBe(3);
    expect(count("OUTSTATION")).toBeGreaterThanOrEqual(3);
    expect(count("DEANERY", "arch")).toBe(1); // archdiocese's own deanery
  });

  it("has unique ids, codes, emails and phones", () => {
    const uniq = (xs: string[]) => new Set(xs).size === xs.length;
    expect(uniq(d.GROUPS.map((g) => g.id))).toBe(true);
    expect(uniq(d.GROUPS.map((g) => g.code))).toBe(true);
    const people = [...d.MEMBERS, ...d.PLATFORM_USERS];
    expect(uniq(people.map((p) => p.id))).toBe(true);
    expect(uniq(people.map((p) => p.email))).toBe(true);
    expect(uniq(people.map((p) => p.telephone))).toBe(true);
  });

  it("gives every operational group exactly one Administrator", () => {
    for (const g of groups.values()) {
      expect(
        d.MEMBERS.filter((m) => m.groupKey === g.key && m.role === "ADMINISTRATOR").length,
      ).toBe(1);
    }
  });

  it("includes one self-registered member awaiting approval (D-011)", () => {
    const pending = d.MEMBERS.filter((x) => x.status === "PENDING");
    expect(pending.length).toBe(1);
    expect(groups.get(pending[0]!.groupKey)!.level).toBe("PARISH");
  });

  it("extra memberships, follows and creator grants point at real people and joinable churches (D-014–D-017)", () => {
    for (const x of d.EXTRA_MEMBERSHIPS) {
      const person = d.memberByFirst(x.first);
      expect(person.groupKey === x.groupKey).toBe(false); // not a duplicate of the home membership
      expect(["PARISH", "OUTSTATION"].includes(groups.get(x.groupKey)!.level)).toBe(true);
    }
    for (const f of d.FOLLOWS) expect(groups.has(f.groupKey)).toBe(true);
    expect(
      d.MEMBER_PRIVILEGES.every((p) => d.memberByFirst(p.first).role !== "ADMINISTRATOR"),
    ).toBe(true);
  });

  it("seeds 4 church roles and no platform roles in `roles` (D-003)", () => {
    expect(d.ROLES.map((r) => r.code)).toEqual([
      "ADMINISTRATOR",
      "MANAGER",
      "SOCIETY_LEADER",
      "PARISHIONER",
    ]);
  });

  it("only grants permissions that exist", () => {
    const codes = new Set(d.PERMISSIONS.map(([c]) => c));
    for (const list of Object.values(d.ROLE_PERMISSIONS))
      for (const c of list) expect(codes.has(c)).toBe(true);
  });

  it("stages collections only for outstations, each with a parish parent, and covers every status", () => {
    for (const c of d.PENDING_COLLECTIONS) {
      const g = groups.get(c.outstation)!;
      expect(g.level).toBe("OUTSTATION");
      expect(groups.get(g.parentKey!)!.level).toBe("PARISH");
    }
    expect(new Set(d.PENDING_COLLECTIONS.map((c) => c.status)).size).toBe(5);
  });

  it("works with resolveAccess (parish oversees its outstation, not the neighbour's)", () => {
    const node = (k: string): GroupNode => ({ ...groups.get(k)!, id: groups.get(k)!.id });
    const byId = new Map([...groups.values()].map((g) => [g.id, node(g.key)]));
    const lookup = (id: string) => byId.get(id);
    expect(resolveAccess(node("parA1"), node("outA1a"), lookup)).toBe("OVERSIGHT");
    expect(resolveAccess(node("parA1"), node("outA2a"), lookup)).toBe("NONE");
    expect(resolveAccess(node("arch"), node("parA1"), lookup)).toBe("MONITOR_AGGREGATE");
  });

  it("society leaders resolve to real members", () => {
    for (const soc of d.SOCIETIES) if (soc.leader) expect(d.leaderOf(soc.leader)).not.toBeNull();
  });
});
