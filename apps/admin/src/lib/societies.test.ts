import { describe, expect, it } from "vitest";
import { KIND_TEXT, rosterFileName } from "./societies";

describe("societies helpers (D-038)", () => {
  it("names roster exports", () => {
    expect(rosterFileName("St Theresa Parish", "Catholic Youth Organisation!")).toBe(
      "st-theresa-parish-catholic-youth-organisation.csv",
    );
  });
  it("has a page per kind", () => {
    expect(KIND_TEXT.COMMITTEE.path).toBe("/admin/committees");
  });
});
