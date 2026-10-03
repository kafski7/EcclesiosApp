import { describe, expect, it } from "vitest";
import { canWrite, feedParams, fromLocalInput, toLocalInput } from "./explore";

describe("explore helpers", () => {
  it("builds feed queries per tab", () => {
    expect(feedParams("ALL", { page: 1 })).toBe("page=1");
    expect(feedParams("EVENTS", { page: 2, q: " mass " })).toBe("page=2&kind=EVENT&q=mass");
    expect(feedParams("FOLLOWING", { page: 1 })).toBe("page=1&following=1");
  });
  it("may write as self or for a church", () => {
    expect(canWrite(undefined)).toBe(false);
    expect(canWrite({ asSelf: false, churches: [] })).toBe(false);
    expect(canWrite({ asSelf: false, churches: [{}] })).toBe(true);
  });
  it("round-trips datetime-local values", () => {
    const iso = new Date(2026, 9, 12, 9, 30).toISOString();
    expect(fromLocalInput(toLocalInput(iso))).toBe(iso);
    expect(fromLocalInput("")).toBe(null);
  });
});
