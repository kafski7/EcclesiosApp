import { describe, expect, it } from "vitest";
import { ago } from "./news";

describe("ago", () => {
  const now = new Date("2026-10-03T12:00:00Z");
  it("relative times", () => {
    expect(ago("2026-10-03T11:59:30Z", now)).toBe("now");
    expect(ago("2026-10-03T11:55:00Z", now)).toBe("5m");
    expect(ago("2026-10-03T09:00:00Z", now)).toBe("3h");
    expect(ago("2026-10-01T12:00:00Z", now)).toBe("2d");
  });
});
