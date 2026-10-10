import { describe, expect, it } from "vitest";
import {
  COLLECTION_ACTIONS,
  COLLECTION_STATUSES,
  InvalidCollectionTransition,
  collectionDateProblem,
  fromMinor,
  isCollectionEditable,
  isCollectionFinal,
  nextCollectionStatus,
  sumAmounts,
  toMinor,
} from "./collections.js";

describe("pending collections state machine (blueprint §8.1)", () => {
  it("happy path: PENDING → APPROVED → SYNCED", () => {
    expect(nextCollectionStatus("PENDING", "approve")).toBe("APPROVED");
    expect(nextCollectionStatus("APPROVED", "syncOk")).toBe("SYNCED");
  });
  it("retry path: APPROVED → SYNC_FAILED → APPROVED", () => {
    expect(nextCollectionStatus("APPROVED", "syncFail")).toBe("SYNC_FAILED");
    expect(nextCollectionStatus("SYNC_FAILED", "retry")).toBe("APPROVED");
  });
  it("reject is final", () => {
    expect(nextCollectionStatus("PENDING", "reject")).toBe("REJECTED");
    expect(isCollectionFinal("REJECTED")).toBe(true);
  });
  it("final states accept no action", () => {
    for (const s of ["SYNCED", "REJECTED"] as const)
      for (const a of COLLECTION_ACTIONS)
        expect(() => nextCollectionStatus(s, a)).toThrow(InvalidCollectionTransition);
  });
  it("cannot approve twice or reject after approval", () => {
    expect(() => nextCollectionStatus("APPROVED", "approve")).toThrow();
    expect(() => nextCollectionStatus("APPROVED", "reject")).toThrow();
  });
  it("only PENDING is editable", () => {
    expect(COLLECTION_STATUSES.filter(isCollectionEditable)).toEqual(["PENDING"]);
  });
});

describe("recording collections (D-041)", () => {
  const today = "2026-10-07";
  it("dates: never future; today unless back-dating is on; at most 90 days back", () => {
    expect(collectionDateProblem(today, today, false)).toBe(null);
    expect(collectionDateProblem("2026-10-08", today, true)).toMatch(/future/);
    expect(collectionDateProblem("2026-10-05", today, false)).toMatch(/switched off/);
    expect(collectionDateProblem("2026-10-05", today, true)).toBe(null);
    expect(collectionDateProblem("2026-07-09", today, true)).toBe(null); // 90 days
    expect(collectionDateProblem("2026-07-08", today, true)).toMatch(/90 days/);
  });
  it("money in minor units, exactly", () => {
    expect(toMinor("120.5")).toBe(12050);
    expect(toMinor("7")).toBe(700);
    expect(fromMinor(12050)).toBe("120.50");
    expect(sumAmounts(["0.10", "0.20", "450.00"])).toBe("450.30");
    expect(() => toMinor("1.234")).toThrow();
  });
});
