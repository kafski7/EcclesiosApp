import { describe, expect, it } from "vitest";
import { fromLocalInput, toLocalInput } from "./news";

describe("datetime-local round trip", () => {
  it("keeps the minute", () => {
    const iso = new Date(2026, 9, 4, 9, 30).toISOString();
    expect(fromLocalInput(toLocalInput(iso))).toBe(iso);
    expect(toLocalInput(null)).toBe("");
    expect(fromLocalInput("")).toBe(null);
  });
});
