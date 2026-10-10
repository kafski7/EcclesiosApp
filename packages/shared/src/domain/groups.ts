/**
 * Church groups in Church Management (functionality §4.13, D-041). Pure rules only.
 * Church Administrators open new groups one level below their own; dioceses, archdioceses and
 * provinces are created on the platform (Phase 8).
 */
import type { HierarchyLevel } from "./levels.js";

const CHILD: Partial<Record<HierarchyLevel, HierarchyLevel>> = {
  PARISH: "OUTSTATION",
  DEANERY: "PARISH",
  DIOCESE: "DEANERY",
  ARCHDIOCESE: "DEANERY",
};

/** The level a church Administrator can create under a group, or null. */
export const childLevelFor = (level: HierarchyLevel): HierarchyLevel | null => CHILD[level] ?? null;

export const LEVEL_NAME: Record<HierarchyLevel, { one: string; many: string }> = {
  VATICAN: { one: "Holy See", many: "Holy See" },
  NUNCIATURE: { one: "nunciature", many: "nunciatures" },
  PROVINCE: { one: "province", many: "provinces" },
  ARCHDIOCESE: { one: "archdiocese", many: "archdioceses" },
  DIOCESE: { one: "diocese", many: "dioceses" },
  DEANERY: { one: "deanery", many: "deaneries" },
  PARISH: { one: "parish", many: "parishes" },
  OUTSTATION: { one: "outstation", many: "outstations" },
};

/** A group can be closed only when nothing open hangs under it (members stay on record). */
export function closeBlocker(g: { activeChildren: number }): "HAS_OPEN_CHILDREN" | null {
  return g.activeChildren > 0 ? "HAS_OPEN_CHILDREN" : null;
}

/** "St. Monica's  outstation" → "ST-MONICAS-OUTSTATION" (suggested code). */
export function suggestCode(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/['’.]/g, "")
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
