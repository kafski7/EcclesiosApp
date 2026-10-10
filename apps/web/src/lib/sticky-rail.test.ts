import { describe, expect, it } from "vitest";
import { nextTop, topRange } from "./sticky-rail";

const box = (railHeight: number) => ({ header: 84, bottomGap: 16, viewport: 900, railHeight });

describe("sticky rail (D-046)", () => {
  it("a short rail always sits under the top bar", () => {
    expect(topRange(box(500))).toEqual({ max: 84, min: 84 });
    expect(nextTop(84, 400, box(500))).toBe(84);
    expect(nextTop(84, -400, box(500))).toBe(84);
  });
  it("a tall rail moves with the page, then stops with its last card on screen", () => {
    // 1400px rail: lowest top is 900 - 1400 - 16 = -516
    expect(topRange(box(1400))).toEqual({ max: 84, min: -516 });
    expect(nextTop(84, 200, box(1400))).toBe(-116);
    expect(nextTop(-116, 1000, box(1400))).toBe(-516);
    expect(nextTop(-516, 5000, box(1400))).toBe(-516); // feed keeps loading, rail stays
  });
  it("scrolling up brings the first card back, then it stays under the top bar", () => {
    expect(nextTop(-516, -300, box(1400))).toBe(-216);
    expect(nextTop(-216, -900, box(1400))).toBe(84);
  });
  it("re-clamps when the rail grows or shrinks (cards loading)", () => {
    expect(nextTop(-516, 0, box(1000))).toBe(-116);
    expect(nextTop(-516, 0, box(600))).toBe(84);
  });
});
