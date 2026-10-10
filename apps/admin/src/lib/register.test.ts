import { describe, expect, it } from "vitest";
import { EMPTY_FILTERS, localToday, registerParams, whenLabel } from "./register";

describe("register helpers (D-037)", () => {
  it("builds queries", () => {
    expect(registerParams(EMPTY_FILTERS, 1)).toBe("page=1");
    expect(
      registerParams({
        ...EMPTY_FILTERS,
        q: " ama ",
        role: "MANAGER",
        missing: "confirmation",
        outstations: true,
      }),
    ).toBe("q=ama&role=MANAGER&missing=confirmation&outstations=1");
  });
  it("labels and dates", () => {
    expect([0, 1, 5].map(whenLabel)).toEqual(["Today", "Tomorrow", "In 5 days"]);
    expect(localToday(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});
