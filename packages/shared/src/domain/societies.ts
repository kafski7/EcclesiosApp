/**
 * Societies & committees (functionality §4.4–4.5, D-038). Pure rules only.
 *
 * - Staff of the church (write) manage societies: create, edit, choose the leader, archive.
 * - The society's leader, and staff, keep its roster (add, remove, positions).
 * - Staff of the church and its parish (readRecords) can read every roster; a leader reads only
 *   the societies they lead.
 */
import type { MemberRole } from "./levels.js";

export type SocietyKind = "SOCIETY" | "COMMITTEE";
export const kindOf = (isCommittee: boolean): SocietyKind =>
  isCommittee ? "COMMITTEE" : "SOCIETY";

export interface SocietyRights {
  /** Read the roster and details. */
  read: boolean;
  /** Add / remove people and set positions. */
  roster: boolean;
  /** Edit details, choose the leader, archive, delete. */
  manage: boolean;
}

/** What someone may do with one society, from their church access and whether they lead it. */
export function societyRights(a: {
  write: boolean;
  readRecords: boolean;
  isLeader: boolean;
}): SocietyRights {
  return {
    read: a.readRecords || a.isLeader,
    roster: a.write || a.isLeader,
    manage: a.write,
  };
}

/**
 * Choosing someone as leader gives them a way into the CMS for their roster: a Parishioner of
 * this church becomes a Society-Leader. Staff roles are never lowered. Returns the new role, or null.
 */
export function leaderPromotion(role: MemberRole): MemberRole | null {
  return role === "PARISHIONER" ? "SOCIETY_LEADER" : null;
}

/** Why someone can't be taken off a roster, or null. */
export function rosterRemovalBlocker(
  personId: string,
  leaderId: string | null,
): "IS_LEADER" | null {
  return leaderId === personId ? "IS_LEADER" : null;
}

/** Only an empty, archived society may be deleted; otherwise archive it (keeps its history). */
export function deleteBlocker(s: {
  isActive: boolean;
  rosterCount: number;
}): "ARCHIVE_FIRST" | "NOT_EMPTY" | null {
  if (s.isActive) return "ARCHIVE_FIRST";
  if (s.rosterCount > 0) return "NOT_EMPTY";
  return null;
}

/** Common officer titles offered in the console; any short text is allowed. */
export const SUGGESTED_POSITIONS = [
  "Vice Chairperson",
  "Secretary",
  "Assistant Secretary",
  "Financial Secretary",
  "Treasurer",
  "Organiser",
  "Patron",
] as const;

/** "  financial   secretary " → "Financial Secretary"; empty → null. */
export function normalisePosition(input: string | null | undefined): string | null {
  const t = (input ?? "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  const small = new Set(["of", "the", "and", "for", "to", "in", "on"]);
  return t
    .split(" ")
    .map((w, i) =>
      i > 0 && small.has(w.toLowerCase())
        ? w.toLowerCase()
        : w.charAt(0).toUpperCase() + w.slice(1),
    )
    .join(" ")
    .slice(0, 60);
}

/** Roster order: leader first, then people with a position (by title), then everyone by surname. */
export function compareRoster(
  a: { isLeader: boolean; position: string | null; lastName: string; firstName: string },
  b: { isLeader: boolean; position: string | null; lastName: string; firstName: string },
): number {
  return (
    Number(b.isLeader) - Number(a.isLeader) ||
    Number(!!b.position) - Number(!!a.position) ||
    (a.position ?? "").localeCompare(b.position ?? "") ||
    a.lastName.localeCompare(b.lastName) ||
    a.firstName.localeCompare(b.firstName)
  );
}
