import { describe, expect, it } from "vitest";
import { badgeCount, claimBlocker, compareStaff, safeInternalLink, timeAgo } from "./account.js";

describe("account rules (D-039)", () => {
  it("only passwordless, active entries can be claimed", () => {
    expect(claimBlocker({ passwordHash: null, active: true })).toBe(null);
    expect(claimBlocker({ passwordHash: "x", active: true })).toBe("NOTHING_TO_CLAIM");
    expect(claimBlocker({ passwordHash: null, active: false })).toBe("NOTHING_TO_CLAIM");
    expect(claimBlocker(null)).toBe("NOTHING_TO_CLAIM");
  });
  it("orders staff by role then name", () => {
    const r = [
      { role: "SOCIETY_LEADER" as const, name: "A" },
      { role: "ADMINISTRATOR" as const, name: "Z" },
      { role: "MANAGER" as const, name: "B" },
      { role: "ADMINISTRATOR" as const, name: "C" },
    ].sort(compareStaff);
    expect(r.map((x) => x.name)).toEqual(["C", "Z", "B", "A"]);
  });
  it("badges, times and links", () => {
    expect([0, 5, 120].map(badgeCount)).toEqual(["", "5", "99+"]);
    const now = new Date("2026-10-07T12:00:00Z");
    expect(timeAgo("2026-10-07T11:59:30Z", now)).toBe("just now");
    expect(timeAgo("2026-10-07T11:00:00Z", now)).toBe("1 hour ago");
    expect(timeAgo("2026-10-06T10:00:00Z", now)).toBe("yesterday");
    expect(safeInternalLink("/admin/members/requests")).toBe("/admin/members/requests");
    expect(safeInternalLink("//evil.com")).toBe(null);
    expect(safeInternalLink("https://x.com")).toBe(null);
  });
});
