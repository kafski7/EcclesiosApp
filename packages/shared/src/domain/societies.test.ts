import { describe, expect, it } from "vitest";
import {
  compareRoster,
  deleteBlocker,
  kindOf,
  leaderPromotion,
  normalisePosition,
  rosterRemovalBlocker,
  societyRights,
} from "./societies.js";

describe("society rights (D-038)", () => {
  it("staff manage, leaders keep their roster, the parish reads", () => {
    expect(societyRights({ write: true, readRecords: true, isLeader: false })).toEqual({
      read: true,
      roster: true,
      manage: true,
    });
    expect(societyRights({ write: false, readRecords: false, isLeader: true })).toEqual({
      read: true,
      roster: true,
      manage: false,
    });
    expect(societyRights({ write: false, readRecords: true, isLeader: false })).toEqual({
      read: true,
      roster: false,
      manage: false,
    });
    expect(societyRights({ write: false, readRecords: false, isLeader: false })).toEqual({
      read: false,
      roster: false,
      manage: false,
    });
  });
  it("leaders: parishioners are promoted, staff untouched", () => {
    expect(leaderPromotion("PARISHIONER")).toBe("SOCIETY_LEADER");
    expect(leaderPromotion("MANAGER")).toBe(null);
    expect(leaderPromotion("SOCIETY_LEADER")).toBe(null);
  });
  it("blocks removing the leader and deleting live or non-empty societies", () => {
    expect(rosterRemovalBlocker("a", "a")).toBe("IS_LEADER");
    expect(rosterRemovalBlocker("a", null)).toBe(null);
    expect(deleteBlocker({ isActive: true, rosterCount: 0 })).toBe("ARCHIVE_FIRST");
    expect(deleteBlocker({ isActive: false, rosterCount: 2 })).toBe("NOT_EMPTY");
    expect(deleteBlocker({ isActive: false, rosterCount: 0 })).toBe(null);
  });
  it("kinds and positions", () => {
    expect(kindOf(true)).toBe("COMMITTEE");
    expect(normalisePosition("  financial   secretary ")).toBe("Financial Secretary");
    expect(normalisePosition("head of the choir")).toBe("Head of the Choir");
    expect(normalisePosition("   ")).toBe(null);
  });
  it("orders the roster", () => {
    const p = (lastName: string, isLeader = false, position: string | null = null) => ({
      lastName,
      firstName: "A",
      isLeader,
      position,
    });
    const r = [
      p("Zed"),
      p("Abe"),
      p("Mid", false, "Treasurer"),
      p("Lead", true),
      p("Sec", false, "Secretary"),
    ].sort(compareRoster);
    expect(r.map((x) => x.lastName)).toEqual(["Lead", "Sec", "Mid", "Abe", "Zed"]);
  });
});
