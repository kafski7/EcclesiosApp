import { describe, expect, it } from "vitest";
import { bibleHref, localToday, neighbours, resolveDate } from "./readings";

describe("readings helpers", () => {
  it("uses the local calendar day", () => {
    expect(localToday(new Date(2026, 9, 2, 23, 30))).toBe("2026-10-02");
  });
  it("falls back to today for missing or invalid dates", () => {
    expect(resolveDate(undefined, "2026-10-02")).toBe("2026-10-02");
    expect(resolveDate("2026-02-30", "2026-10-02")).toBe("2026-10-02");
    expect(resolveDate("2026-12-25", "2026-10-02")).toBe("2026-12-25");
  });
  it("steps across month and year ends", () => {
    expect(neighbours("2026-12-31")).toEqual({ prev: "2026-12-30", next: "2027-01-01" });
  });
  it("builds Bible links", () => {
    expect(bibleHref("Luke 10:13-16")).toBe("/bible?ref=Luke%2010%3A13-16");
  });
});
