import type { MeResponse, Principal } from "@ecclesios/shared";

/**
 * Pure rules for the social shell (docs/social.md §5–6, D-042).
 * Kept framework-free so they are unit-tested without a DOM.
 */

/** "Ama K. Mensah" → "AM"; empty → "•". */
export function initials(name: string): string {
  const parts = name
    .split(/[\s.@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase());
  return parts.length ? parts.join("") : "•";
}

/** Staff roles that open Church Management (D-020): any ACTIVE membership with one of them. */
const CMS_ROLES = new Set(["ADMINISTRATOR", "MANAGER", "SOCIETY_LEADER"]);

/**
 * Where the account menu's "Church Management" item points, or null when the account has no
 * console access (social.md §6.3, S-005). Platform accounts use the console's platform door
 * (D-019); church staff use the church door. The console checks again on sign-in — this only
 * decides whether to show the link.
 */
export function consoleLink(
  principal: Principal | null,
  me: MeResponse | undefined,
  adminUrl: string,
): string | null {
  if (!principal) return null;
  const base = adminUrl.replace(/\/+$/, "");
  if (principal.kind === "user") return `${base}/admin-login`;
  const staff = me?.memberships.some((m) => m.status === "ACTIVE" && CMS_ROLES.has(m.role));
  return staff ? `${base}/login` : null;
}

/** The home church line under the name in the account menu. */
export function homeChurchLabel(me: MeResponse | undefined): string | null {
  const home = me?.memberships.find((m) => m.isHome);
  if (!home) return null;
  return home.status === "PENDING" ? `${home.church.name} · pending` : home.church.name;
}

/** Global search (social.md §5.2, §9.11). */
export const SEARCH_MIN = 2;
export const SEARCH_MAX = 100;

/** Trims, collapses spaces and caps the length (the APIs accept at most 100 characters). */
export function normalizeQuery(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\s+/g, " ").trim().slice(0, SEARCH_MAX);
}

export const isSearchable = (q: string) => normalizeQuery(q).length >= SEARCH_MIN;

/** Results page URL for a query (empty query → the bare page). */
export function searchPath(raw: string): string {
  const q = normalizeQuery(raw);
  return q ? `/search?q=${encodeURIComponent(q)}` : "/search";
}

/** "See all" link into a section that accepts ?q= itself. */
export const sectionSearchPath = (section: string, q: string) =>
  `${section}?q=${encodeURIComponent(normalizeQuery(q))}`;
