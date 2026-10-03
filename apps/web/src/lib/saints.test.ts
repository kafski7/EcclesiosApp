import { describe, expect, it } from "vitest";
import { medalInitials } from "./saints";

describe("medalInitials", () => {
  it("uses capitalised words only", () => {
    expect(medalInitials("Thérèse of the Child Jesus")).toBe("TC");
    expect(medalInitials("Augustine")).toBe("A");
    expect(medalInitials("Michael, Gabriel and Raphael")).toBe("MG");
  });
});
