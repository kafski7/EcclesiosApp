import { describe, expect, it } from "vitest";
import { makeTree } from "./fixture.js";
import {
  canDecideMembership,
  canEditSacramentalRecords,
  hasCapability,
  homeOf,
  homeTransferBlocker,
  nextHomeTransferStatus,
  InvalidMembershipTransition,
  isJoinableLevel,
  nextMembershipStatus,
  resolveMemberAccess,
  type MembershipNode,
} from "./memberships.js";
import { canPostAsChurch, canPostAsSelf } from "./explore.js";
import type { MemberRole } from "./levels.js";

const { g, lookup } = makeTree();
const ms = (
  key: string,
  role: MemberRole,
  status: MembershipNode["status"] = "ACTIVE",
): MembershipNode => ({
  group: g(key),
  role,
  status,
});

describe("membership status machine", () => {
  it("request → approve / reject; leave; rejoin", () => {
    expect(nextMembershipStatus("PENDING", "approve")).toBe("ACTIVE");
    expect(nextMembershipStatus("PENDING", "reject")).toBe("REJECTED");
    expect(nextMembershipStatus("PENDING", "leave")).toBe("LEFT");
    expect(nextMembershipStatus("ACTIVE", "leave")).toBe("LEFT");
    expect(nextMembershipStatus("LEFT", "rejoin")).toBe("PENDING");
    expect(nextMembershipStatus("REJECTED", "rejoin")).toBe("PENDING");
  });
  it("refuses impossible moves", () => {
    expect(() => nextMembershipStatus("ACTIVE", "approve")).toThrow(InvalidMembershipTransition);
    expect(() => nextMembershipStatus("REJECTED", "approve")).toThrow(InvalidMembershipTransition);
  });
  it("only parishes and outstations are joinable", () => {
    expect(isJoinableLevel("PARISH")).toBe(true);
    expect(isJoinableLevel("OUTSTATION")).toBe(true);
    expect(isJoinableLevel("DEANERY")).toBe(false);
  });
});

describe("resolveMemberAccess (D-015)", () => {
  it("a pending request grants nothing", () => {
    expect(
      resolveMemberAccess([ms("parA1", "PARISHIONER", "PENDING")], g("parA1"), lookup),
    ).toEqual([]);
  });
  it("an active parishioner gets MEMBER on their church only", () => {
    const p = [ms("parA1", "PARISHIONER")];
    expect(resolveMemberAccess(p, g("parA1"), lookup)).toEqual(["MEMBER"]);
    expect(resolveMemberAccess(p, g("outA1a"), lookup)).toEqual([]);
    expect(hasCapability(resolveMemberAccess(p, g("parA1"), lookup), "memberContent")).toBe(true);
    expect(hasCapability(resolveMemberAccess(p, g("parA1"), lookup), "readRecords")).toBe(false);
  });
  it("staff inherit hierarchy access", () => {
    expect(resolveMemberAccess([ms("parA1", "ADMINISTRATOR")], g("outA1a"), lookup)).toEqual([
      "OVERSIGHT",
    ]);
    expect(resolveMemberAccess([ms("deanA", "MANAGER")], g("parA1"), lookup)).toEqual([
      "MONITOR_DETAILED",
    ]);
  });
  it("several memberships combine, strongest first", () => {
    const p = [
      ms("parA1", "PARISHIONER"),
      ms("deanA", "ADMINISTRATOR"),
      ms("outA1a", "PARISHIONER"),
    ];
    expect(resolveMemberAccess(p, g("parA1"), lookup)).toEqual(["MONITOR_DETAILED", "MEMBER"]);
    expect(resolveMemberAccess(p, g("outA1a"), lookup)).toEqual(["MONITOR_DETAILED", "MEMBER"]);
    expect(resolveMemberAccess(p, g("parB1"), lookup)).toEqual([]);
  });
  it("left or rejected memberships count for nothing", () => {
    expect(resolveMemberAccess([ms("parA1", "ADMINISTRATOR", "LEFT")], g("parA1"), lookup)).toEqual(
      [],
    );
  });
});

describe("who approves join requests (D-016)", () => {
  it("the church's own Administrator", () => {
    expect(canDecideMembership([ms("outA1a", "ADMINISTRATOR")], g("outA1a"), lookup)).toBe(true);
  });
  it("the parish Administrator as backup for its outstations", () => {
    expect(canDecideMembership([ms("parA1", "ADMINISTRATOR")], g("outA1a"), lookup)).toBe(true);
    expect(canDecideMembership([ms("parA1", "ADMINISTRATOR")], g("outA2a"), lookup)).toBe(false);
  });
  it("not managers, deans, members, or pending admins", () => {
    expect(canDecideMembership([ms("parA1", "MANAGER")], g("parA1"), lookup)).toBe(false);
    expect(canDecideMembership([ms("deanA", "ADMINISTRATOR")], g("parA1"), lookup)).toBe(false);
    expect(canDecideMembership([ms("parA1", "PARISHIONER")], g("parA1"), lookup)).toBe(false);
    expect(canDecideMembership([ms("parA1", "ADMINISTRATOR", "PENDING")], g("parA1"), lookup)).toBe(
      false,
    );
    expect(canDecideMembership([ms("outA1a", "ADMINISTRATOR")], g("parA1"), lookup)).toBe(false);
  });
});

describe("home church & sacramental records (D-016)", () => {
  const mine = [
    { groupId: "parA1", status: "ACTIVE" as const, isHome: true },
    { groupId: "outA2a", status: "ACTIVE" as const, isHome: false },
    { groupId: "parB1", status: "PENDING" as const, isHome: false },
  ];
  it("finds the home and validates transfers", () => {
    expect(homeOf(mine)?.groupId).toBe("parA1");
    expect(homeTransferBlocker(mine, "outA2a")).toBe(null);
    expect(homeTransferBlocker(mine, "parA1")).toBe("ALREADY_HOME");
    expect(homeTransferBlocker(mine, "parB1")).toBe("NOT_AN_ACTIVE_MEMBER");
    expect(homeTransferBlocker(mine, "nowhere")).toBe("NOT_AN_ACTIVE_MEMBER");
  });
  it("only staff of the home church (or its parish) edit the records", () => {
    expect(canEditSacramentalRecords([ms("parA1", "MANAGER")], g("parA1"), lookup)).toBe(true);
    expect(canEditSacramentalRecords([ms("parA1", "ADMINISTRATOR")], g("outA1a"), lookup)).toBe(
      true,
    );
    expect(canEditSacramentalRecords([ms("parA2", "ADMINISTRATOR")], g("parA1"), lookup)).toBe(
      false,
    );
    expect(canEditSacramentalRecords([ms("deanA", "ADMINISTRATOR")], g("parA1"), lookup)).toBe(
      false,
    );
    expect(canEditSacramentalRecords([ms("parA1", "PARISHIONER")], g("parA1"), lookup)).toBe(false);
    expect(canEditSacramentalRecords([ms("parA1", "ADMINISTRATOR")], undefined, lookup)).toBe(
      false,
    );
  });
});

describe("Explore posting (D-017)", () => {
  const member = (
    privileges: ("AUTHOR_EXPLORE" | "POST_PODCASTS")[],
    memberships: MembershipNode[] = [],
  ) => ({ kind: "member", privileges, memberships }) as const;
  it("ordinary members cannot post", () => {
    expect(canPostAsSelf(member([], [ms("parA1", "PARISHIONER")]))).toBe(false);
  });
  it("approved creators post as themselves", () => {
    expect(canPostAsSelf(member(["AUTHOR_EXPLORE"]))).toBe(true);
    expect(canPostAsSelf(member(["POST_PODCASTS"]))).toBe(false);
  });
  it("church Administrators post in their church's name only", () => {
    const priest = member([], [ms("parA1", "ADMINISTRATOR")]);
    expect(canPostAsChurch(priest, g("parA1").id)).toBe(true);
    expect(canPostAsChurch(priest, g("outA1a").id)).toBe(false);
    expect(canPostAsSelf(priest)).toBe(false);
    expect(canPostAsChurch(member([], [ms("parA1", "MANAGER")]), g("parA1").id)).toBe(false);
  });
  it("platform: Super-Admin always, users with the grant", () => {
    expect(canPostAsSelf({ kind: "user", role: "SUPER_ADMIN", privileges: [] })).toBe(true);
    expect(canPostAsSelf({ kind: "user", role: "CREATOR", privileges: [] })).toBe(false);
    expect(canPostAsSelf({ kind: "user", role: "CREATOR", privileges: ["AUTHOR_EXPLORE"] })).toBe(
      true,
    );
    expect(canPostAsChurch({ kind: "user", role: "SUPER_ADMIN", privileges: [] }, "x")).toBe(false);
  });
});

describe("home transfer status (D-049)", () => {
  it("only an open request moves", () => {
    expect(nextHomeTransferStatus("PENDING", "approve")).toBe("APPROVED");
    expect(nextHomeTransferStatus("PENDING", "reject")).toBe("REJECTED");
    expect(nextHomeTransferStatus("PENDING", "cancel")).toBe("CANCELLED");
    for (const done of ["APPROVED", "REJECTED", "CANCELLED"] as const)
      expect(nextHomeTransferStatus(done, "approve")).toBeNull();
  });
});
