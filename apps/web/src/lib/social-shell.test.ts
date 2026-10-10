import type { MeResponse, MyMembership, Principal } from "@ecclesios/shared";
import { describe, expect, it } from "vitest";
import {
  consoleLink,
  homeChurchLabel,
  initials,
  isSearchable,
  normalizeQuery,
  searchPath,
  sectionSearchPath,
} from "./social-shell";

const ADMIN = "http://localhost:5174/";
const member: Principal = { kind: "member", id: "00000000-0000-4000-8000-000000000001" };
const platform: Principal = {
  kind: "user",
  id: "00000000-0000-4000-8000-000000000002",
  role: "SUPER_ADMIN",
};

const membership = (over: Partial<MyMembership>): MyMembership => ({
  id: "00000000-0000-4000-8000-0000000000aa",
  church: { id: "00000000-0000-4000-8000-0000000000bb", name: "St Peter", level: "PARISH" },
  role: "PARISHIONER",
  status: "ACTIVE",
  isHome: true,
  requestedAt: "2026-10-01T00:00:00.000Z",
  ...over,
});

const me = (memberships: MyMembership[]): MeResponse => ({
  id: member.id,
  firstName: "Ama",
  lastName: "Mensah",
  email: null,
  telephone: null,
  privileges: [],
  memberships,
  follows: [],
  homeTransfer: null,
});

describe("initials", () => {
  it("takes the first two name parts", () => expect(initials("Ama Kafui Mensah")).toBe("AK"));
  it("handles emails and blanks", () => {
    expect(initials("ama.mensah@x.com")).toBe("AM");
    expect(initials("  ")).toBe("•");
  });
});

describe("consoleLink (social.md S-005, D-020)", () => {
  it("visitors get no console link", () => expect(consoleLink(null, undefined, ADMIN)).toBeNull());
  it("platform accounts use the platform door", () =>
    expect(consoleLink(platform, undefined, ADMIN)).toBe("http://localhost:5174/admin-login"));
  it("parishioners get none", () =>
    expect(consoleLink(member, me([membership({})]), ADMIN)).toBeNull());
  it.each(["ADMINISTRATOR", "MANAGER", "SOCIETY_LEADER"] as const)(
    "ACTIVE %s gets the church door",
    (role) =>
      expect(consoleLink(member, me([membership({ role })]), ADMIN)).toBe(
        "http://localhost:5174/login",
      ),
  );
  it("a PENDING or LEFT staff membership grants nothing", () => {
    expect(
      consoleLink(member, me([membership({ role: "ADMINISTRATOR", status: "PENDING" })]), ADMIN),
    ).toBeNull();
    expect(
      consoleLink(member, me([membership({ role: "MANAGER", status: "LEFT" })]), ADMIN),
    ).toBeNull();
  });
  it("any one staff membership is enough, home or not", () =>
    expect(
      consoleLink(
        member,
        me([membership({}), membership({ role: "MANAGER", isHome: false })]),
        ADMIN,
      ),
    ).not.toBeNull());
  it("me not loaded yet → hidden", () => expect(consoleLink(member, undefined, ADMIN)).toBeNull());
});

describe("homeChurchLabel", () => {
  it("names the home church, marking pending", () => {
    expect(homeChurchLabel(me([membership({})]))).toBe("St Peter");
    expect(homeChurchLabel(me([membership({ status: "PENDING" })]))).toBe("St Peter · pending");
    expect(homeChurchLabel(me([]))).toBeNull();
  });
});

describe("global search helpers (social.md §5.2)", () => {
  it("normalizes whitespace and caps at 100", () => {
    expect(normalizeQuery("  holy   spirit ")).toBe("holy spirit");
    expect(normalizeQuery("x".repeat(150))).toHaveLength(100);
    expect(normalizeQuery(null)).toBe("");
  });
  it("needs two characters", () => {
    expect(isSearchable(" a ")).toBe(false);
    expect(isSearchable("ab")).toBe(true);
  });
  it("builds encoded URLs", () => {
    expect(searchPath("NCH 56")).toBe("/search?q=NCH%2056");
    expect(searchPath("   ")).toBe("/search");
    expect(sectionSearchPath("/hymnal", " Ave  Maria ")).toBe("/hymnal?q=Ave%20Maria");
  });
});
