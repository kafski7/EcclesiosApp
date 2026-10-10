import { describe, expect, it } from "vitest";
import { formatPhone, isPhone, normalisePhone } from "./phone.js";

describe("phone numbers (D-040)", () => {
  it.each([
    ["0241234567", "+233241234567"],
    ["024 123 4567", "+233241234567"],
    ["024-123-4567", "+233241234567"],
    ["(024) 123.4567", "+233241234567"],
    ["+233 24 123 4567", "+233241234567"],
    ["233241234567", "+233241234567"],
    ["00233241234567", "+233241234567"],
    ["+2348031234567", "+2348031234567"],
    ["+44 20 7946 0958", "+442079460958"],
  ])("%s → %s", (input, out) => {
    expect(normalisePhone(input)).toBe(out);
    expect(isPhone(input)).toBe(true);
  });
  it("rejects what isn't a number", () => {
    expect(isPhone("12345")).toBe(false);
    expect(isPhone("call me")).toBe(false);
    expect(isPhone("")).toBe(false);
    expect(normalisePhone("  ")).toBe("");
  });
  it("formats Ghana numbers for display", () => {
    expect(formatPhone("+233241234567")).toBe("+233 24 123 4567");
    expect(formatPhone("+442079460958")).toBe("+442079460958");
    expect(formatPhone(null)).toBe("");
  });
});
