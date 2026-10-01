import { describe, expect, it } from "vitest";
import type { Access } from "./access.js";
import { canApprove, canReadSummaries, canWrite, resolveAccess } from "./access.js";
import type { MetropolitanVisibility } from "./levels.js";
import { makeTree } from "./fixture.js";

type Row = [viewer: string, target: string, expected: Access];

/** blueprint §3.5 — default suffragan visibility ("aggregates"). */
const MATRIX: Row[] = [
  // own
  ["parA1", "parA1", "OWN"],
  ["outA1a", "outA1a", "OWN"],
  ["prov", "prov", "OWN"],
  // parish → outstation
  ["parA1", "outA1a", "OVERSIGHT"],
  ["parA1", "outA1b", "OVERSIGHT"],
  ["parA1", "outA2a", "NONE"], //  neighbouring parish's outstation
  ["parA1", "parA2", "NONE"], //   sibling parish
  ["parA1", "deanA", "NONE"], //   upward
  // outstation
  ["outA1a", "outA1b", "NONE"], // sibling
  ["outA1a", "parA1", "NONE"], //  upward
  // deanery
  ["deanA", "parA1", "MONITOR_DETAILED"],
  ["deanA", "outA1a", "MONITOR_DETAILED"],
  ["deanA", "parB1", "NONE"], //   other deanery
  ["deanA", "dio", "NONE"],
  // diocese
  ["dio", "deanA", "MONITOR_AGGREGATE"],
  ["dio", "outA2a", "MONITOR_AGGREGATE"],
  ["dio", "archPar", "NONE"], //   archdiocese's own parish is not below the suffragan
  ["dio", "arch", "NONE"],
  // archdiocese — own deanery vs suffragan
  ["arch", "archDean", "MONITOR_AGGREGATE"],
  ["arch", "archPar", "MONITOR_AGGREGATE"],
  ["arch", "dio", "MONITOR_AGGREGATE"],
  ["arch", "parA1", "MONITOR_AGGREGATE"],
  ["arch", "prov", "NONE"],
  // province — everything below, aggregated
  ["prov", "arch", "MONITOR_AGGREGATE"],
  ["prov", "dio", "MONITOR_AGGREGATE"],
  ["prov", "outA1a", "MONITOR_AGGREGATE"],
];

describe("resolveAccess — default matrix", () => {
  const { g, lookup } = makeTree();
  it.each(MATRIX)("%s → %s = %s", (v, t, expected) => {
    expect(resolveAccess(g(v), g(t), lookup)).toBe(expected);
  });
});

describe("resolveAccess — suffragan metropolitan_visibility (D-002)", () => {
  const cases: [MetropolitanVisibility, Access][] = [
    ["hidden", "NONE"],
    ["aggregates", "MONITOR_AGGREGATE"],
    ["detailed", "MONITOR_DETAILED"],
  ];
  it.each(cases)("visibility=%s → archdiocese sees suffragan as %s", (vis, expected) => {
    const { g, lookup } = makeTree(vis);
    for (const t of ["dio", "deanA", "parA1", "outA1a"]) {
      expect(resolveAccess(g("arch"), g(t), lookup)).toBe(expected);
    }
  });
  it.each(["hidden", "aggregates", "detailed"] as const)(
    "visibility=%s never affects the archdiocese's own deanery or the province",
    (vis) => {
      const { g, lookup } = makeTree(vis);
      expect(resolveAccess(g("arch"), g("archPar"), lookup)).toBe("MONITOR_AGGREGATE");
      expect(resolveAccess(g("prov"), g("parA1"), lookup)).toBe("MONITOR_AGGREGATE");
    },
  );
  it("archdiocese never gets write or approve on a suffragan", () => {
    const { g, lookup } = makeTree("detailed");
    const a = resolveAccess(g("arch"), g("parA1"), lookup);
    expect(canWrite(a)).toBe(false);
    expect(canApprove(a)).toBe(false);
    expect(canReadSummaries(a)).toBe(true);
  });
});

describe("resolveAccess — fails closed", () => {
  it("throws if an intermediate node on the path was not loaded", () => {
    const { g } = makeTree();
    expect(() => resolveAccess(g("arch"), g("parA1"), () => undefined)).toThrow(/not loaded/);
  });
});

describe("capabilities", () => {
  it("only OWN writes; only OVERSIGHT approves", () => {
    expect(canWrite("OWN")).toBe(true);
    expect(canWrite("OVERSIGHT")).toBe(false);
    expect(canApprove("OVERSIGHT")).toBe(true);
    expect(canApprove("OWN")).toBe(false);
    expect(canReadSummaries("MONITOR_AGGREGATE")).toBe(false);
  });
});
