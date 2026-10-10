/**
 * Accounts, notifications, staff and church settings (functionality §4.6, §4.8–4.10, D-039). Pure rules only.
 */
import type { MemberRole } from "./levels.js";

/** Staff list order on Users & Roles. */
export const STAFF_ORDER: readonly MemberRole[] = ["ADMINISTRATOR", "MANAGER", "SOCIETY_LEADER"];
export const isListedStaff = (r: MemberRole) => STAFF_ORDER.includes(r);
export const compareStaff = (
  a: { role: MemberRole; name: string },
  b: { role: MemberRole; name: string },
) => STAFF_ORDER.indexOf(a.role) - STAFF_ORDER.indexOf(b.role) || a.name.localeCompare(b.name);

/**
 * A register entry that staff added (no password yet) can be claimed by the person: they prove the
 * email or phone with a code, then set a password (D-039). Anything else can't be claimed.
 */
export function claimBlocker(
  a: { passwordHash: string | null; active: boolean } | null,
): "NOTHING_TO_CLAIM" | null {
  if (!a || a.passwordHash || !a.active) return "NOTHING_TO_CLAIM";
  return null;
}

/** "3" → "3", 120 → "99+" for badges. */
export const badgeCount = (n: number) => (n <= 0 ? "" : n > 99 ? "99+" : String(n));

/** "2 minutes ago", "yesterday", "12 Oct" — relative time for notification lists. */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const s = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  if (d === 1) return "yesterday";
  if (d < 7) return `${d} days ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** Internal links only: a notification link must stay inside the app ("/…", not "//…" or a URL). */
export const safeInternalLink = (link: string | null | undefined) =>
  link && link.startsWith("/") && !link.startsWith("//") ? link : null;
