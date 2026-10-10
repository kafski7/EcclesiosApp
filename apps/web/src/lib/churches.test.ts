import type { MeResponse, MyMembership } from "@ecclesios/shared";
import { describe, expect, it } from "vitest";
import { churchPlace, myChurches } from "./churches";

const church = (n: number, name = `Church ${n}`) => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  name,
  level: "PARISH",
});
const m = (n: number, over: Partial<MyMembership> = {}): MyMembership => ({
  id: `00000000-0000-4000-9000-${String(n).padStart(12, "0")}`,
  church: church(n),
  role: "PARISHIONER",
  status: "ACTIVE",
  isHome: false,
  requestedAt: "2026-10-01T00:00:00.000Z",
  ...over,
});
const me = (
  memberships: MyMembership[],
  follows = [] as ReturnType<typeof church>[],
): MeResponse => ({
  id: "00000000-0000-4000-8000-0000000000ff",
  firstName: "Ama",
  lastName: "Mensah",
  email: null,
  telephone: null,
  privileges: [],
  memberships,
  follows,
  homeTransfer: null,
});

describe("myChurches (D-044)", () => {
  it("is empty for visitors", () => expect(myChurches(undefined)).toEqual([]));
  it("puts the home church first, then memberships, then follows, each once", () => {
    const r = myChurches(me([m(2), m(1, { isHome: true })], [church(3), church(2)]));
    expect(r.map((c) => [c.name, c.why])).toEqual([
      ["Church 1", "home"],
      ["Church 2", "member"],
      ["Church 3", "follow"],
    ]);
  });
  it("leaves out rejected and former memberships but keeps pending ones", () => {
    const r = myChurches(
      me([
        m(1, { status: "REJECTED" }),
        m(2, { status: "LEFT" }),
        m(3, { status: "PENDING", isHome: true }),
      ]),
    );
    expect(r.map((c) => c.name)).toEqual(["Church 3"]);
  });
});

describe("churchPlace", () => {
  it("describes parishes and outstations", () => {
    expect(
      churchPlace({
        ...church(1),
        level: "PARISH",
        parish: null,
        deanery: "Tema Deanery",
        diocese: "Archdiocese of Accra",
      }),
    ).toBe("Parish · Tema Deanery · Archdiocese of Accra");
    expect(
      churchPlace({
        ...church(2),
        level: "OUTSTATION",
        parish: "St Paul",
        deanery: null,
        diocese: "Archdiocese of Accra",
      }),
    ).toBe("Outstation of St Paul · Archdiocese of Accra");
  });
});
