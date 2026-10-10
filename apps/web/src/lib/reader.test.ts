import { describe, expect, it } from "vitest";
import { clampScale, migratedScale, scalePercent, stepScale } from "./reader";

describe("reader text size (D-045)", () => {
  it("clamps and rounds", () => {
    expect(clampScale(3)).toBe(1.5);
    expect(clampScale(0.2)).toBe(0.85);
    expect(clampScale(Number.NaN)).toBe(1);
    expect(stepScale(1, 1)).toBe(1.1);
    expect(stepScale(stepScale(1, 1), 1)).toBe(1.2);
    expect(stepScale(0.9, -1)).toBe(0.85);
  });
  it("shows a percentage", () => expect(scalePercent(1.2)).toBe("120%"));
  it("carries over the Bible's old size", () => {
    expect(
      migratedScale(JSON.stringify({ state: { fontScale: 1.3, translation: "WEBC" }, version: 0 })),
    ).toBe(1.3);
    expect(migratedScale(JSON.stringify({ state: { fontScale: 9 } }))).toBe(1.5);
    expect(migratedScale(null)).toBe(1);
    expect(migratedScale("{not json")).toBe(1);
    expect(migratedScale(JSON.stringify({ state: {} }))).toBe(1);
  });
});
