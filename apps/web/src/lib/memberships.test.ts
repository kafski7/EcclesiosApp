import type { MeResponse, MyMembership } from "@ecclesios/shared";
import { describe, expect, it } from "vitest";
import { churchRows, followOnly, standingWith } from "./memberships";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const church = (n: number, name: string) => ({ id: id(n), name, level: "PARISH" });
const m = (n: number, name: string, over: Partial<MyMembership> = {}): MyMembership => ({
  id: id(100 + n),
  church: church(n, name),
  role: "PARISHIONER",
  status: "ACTIVE",
  isHome: false,
  requestedAt: "2026-10-01T00:00:00.000Z",
  ...over,
});
const me = (memberships: MyMembership[], over: Partial<MeResponse> = {}): MeResponse => ({
  id: id(999),
  firstName: "Ama",
  lastName: "Mensah",
  email: null,
  telephone: null,
  privileges: [],
  memberships,
  follows: [],
  homeTransfer: null,
  ...over,
});

describe("standingWith (D-049)", () => {
  const x = me([m(1, "St Peter", { isHome: true }), m(2, "St Paul"), m(3, "St Mary", { status: "PENDING" })]);
  it("tells home, member, pending and none apart", () => {
    expect(standingWith(x, id(1))).toBe("home");
    expect(standingWith(x, id(2))).toBe("member");
    expect(standingWith(x, id(3))).toBe("pending");
    expect(standingWith(x, id(4))).toBe("none");
    expect(standingWith(undefined, id(1))).toBe("none");
  });
});

describe("churchRows", () => {
  it("orders home, active, pending; offers moving home only where it can happen", () => {
    const rows = churchRows(
      me([m(3, "St Mary", { status: "PENDING" }), m(2, "St Paul"), m(1, "St Peter", { isHome: true }), m(4, "All Saints")]),
    );
    expect(rows.map((r) => r.m.church.name)).toEqual(["St Peter", "All Saints", "St Paul", "St Mary"]);
    expect(rows.map((r) => r.canMakeHome)).toEqual([false, true, true, false]);
  });
  it("while a transfer waits, no other move is offered and the target is marked", () => {
    const rows = churchRows(
      me([m(1, "St Peter", { isHome: true }), m(2, "St Paul")], {
        homeTransfer: { id: id(50), from: church(1, "St Peter"), to: church(2, "St Paul"), requestedAt: "2026-10-02T00:00:00.000Z" },
      }),
    );
    expect(rows.map((r) => [r.transferWaiting, r.canMakeHome])).toEqual([
      [false, false],
      [true, false],
    ]);
  });
});

describe("followOnly", () => {
  it("lists follows that aren't memberships", () => {
    const x = me([m(1, "St Peter")], { follows: [church(1, "St Peter"), church(5, "Holy Cross")] });
    expect(followOnly(x).map((c) => c.name)).toEqual(["Holy Cross"]);
  });
});
