import type { HierarchyLevel } from "@ecclesios/shared/domain";
import { pathIds } from "@ecclesios/shared/domain";

export interface NamedNode {
  id: string;
  name: string;
  level: HierarchyLevel;
}

/**
 * Builds the "St Joseph Deanery · Sample Suffragan Diocese" context shown under each
 * parish in the sign-up picker, from the parish's materialised path (D-005).
 * Pure so it is unit-testable without a database.
 */
export function describeParish(path: string, nodes: Map<string, NamedNode>) {
  const ancestors = pathIds(path)
    .slice(0, -1)
    .map((id) => nodes.get(id))
    .filter((n): n is NamedNode => Boolean(n));
  const deanery = [...ancestors].reverse().find((n) => n.level === "DEANERY") ?? null;
  const diocese =
    [...ancestors].reverse().find((n) => n.level === "DIOCESE" || n.level === "ARCHDIOCESE") ??
    null;
  return { deanery: deanery?.name ?? null, diocese: diocese?.name ?? null };
}

/** Ancestor ids for a batch of paths, de-duplicated (one query for all labels). */
export const ancestorIds = (paths: string[]) => [
  ...new Set(paths.flatMap((p) => pathIds(p).slice(0, -1))),
];

/** Like describeParish, plus the overseeing parish when the church is an outstation (D-014). */
export function describeChurch(path: string, level: HierarchyLevel, nodes: Map<string, NamedNode>) {
  const base = describeParish(path, nodes);
  if (level !== "OUTSTATION") return { parish: null, ...base };
  const ids = pathIds(path);
  const parent = nodes.get(ids[ids.length - 2] ?? "");
  return { parish: parent?.level === "PARISH" ? parent.name : null, ...base };
}
