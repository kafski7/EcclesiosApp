/**
 * Ecclesiastical hierarchy (blueprint §3). Dependency-free so packages/db
 * and the API can share it without pulling in Zod.
 * Order: top → bottom. Lower rank = higher in the hierarchy.
 */
export const HIERARCHY_LEVELS = [
  "VATICAN",
  "NUNCIATURE",
  "PROVINCE",
  "ARCHDIOCESE",
  "DIOCESE",
  "DEANERY",
  "PARISH",
  "OUTSTATION",
] as const;
export type HierarchyLevel = (typeof HIERARCHY_LEVELS)[number];

/** Levels a CMS group may operate at in this deployment (Vatican/Nunciature are model-only). */
export const OPERATIONAL_LEVELS = [
  "PROVINCE",
  "ARCHDIOCESE",
  "DIOCESE",
  "DEANERY",
  "PARISH",
  "OUTSTATION",
] as const satisfies readonly HierarchyLevel[];

export const levelRank = (level: HierarchyLevel): number => HIERARCHY_LEVELS.indexOf(level);

/**
 * Which parent levels each level may hang under (blueprint §3, §3.4).
 * A DIOCESE under an ARCHDIOCESE is a *suffragan*.
 */
export const ALLOWED_PARENTS: Record<HierarchyLevel, readonly (HierarchyLevel | null)[]> = {
  VATICAN: [null],
  NUNCIATURE: ["VATICAN", null],
  PROVINCE: ["NUNCIATURE", null],
  ARCHDIOCESE: ["PROVINCE"],
  DIOCESE: ["ARCHDIOCESE"],
  DEANERY: ["ARCHDIOCESE", "DIOCESE"],
  PARISH: ["DEANERY"],
  OUTSTATION: ["PARISH"],
};

export const isValidParent = (child: HierarchyLevel, parent: HierarchyLevel | null): boolean =>
  ALLOWED_PARENTS[child].includes(parent);

/** Church (members) roles — functionality §1. */
export const MEMBER_ROLES = ["ADMINISTRATOR", "MANAGER", "SOCIETY_LEADER", "PARISHIONER"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

/** Platform (users) roles — never mixed with member roles (decision D-003). */
export const PLATFORM_ROLES = ["SUPER_ADMIN", "CREATOR"] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

/** Creator privileges granted by a Super-Admin (functionality §1). */
/** SELL_BOOKS: may list e-books for sale or free (D-036). */
export const PLATFORM_PRIVILEGES = ["POST_PODCASTS", "AUTHOR_EXPLORE", "SELL_BOOKS"] as const;
export type PlatformPrivilege = (typeof PLATFORM_PRIVILEGES)[number];

/** Suffragan → metropolitan visibility (blueprint §3.4, decision D-002). */
export const METROPOLITAN_VISIBILITY = ["hidden", "aggregates", "detailed"] as const;
export type MetropolitanVisibility = (typeof METROPOLITAN_VISIBILITY)[number];
export const DEFAULT_METROPOLITAN_VISIBILITY: MetropolitanVisibility = "aggregates";
