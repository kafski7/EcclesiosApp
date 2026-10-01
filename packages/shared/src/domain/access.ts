import type { HierarchyLevel, MetropolitanVisibility } from "./levels";
import { DEFAULT_METROPOLITAN_VISIBILITY } from "./levels";
import { isStrictDescendant, pathIds } from "./path";

/** Result of viewer → target resolution (blueprint §3.5). Ordered most → least powerful. */
export const ACCESS_LEVELS = [
  "OWN",
  "OVERSIGHT",
  "MONITOR_DETAILED",
  "MONITOR_AGGREGATE",
  "NONE",
] as const;
export type Access = (typeof ACCESS_LEVELS)[number];

export interface GroupNode {
  id: string;
  level: HierarchyLevel;
  path: string;
  /** Only meaningful for suffragan DIOCESE nodes. */
  metropolitanVisibility?: MetropolitanVisibility;
}

/** Look up any group by id (used to find the suffragan diocese on a path). */
export type GroupLookup = (id: string) => GroupNode | undefined;

/**
 * Resolve what `viewer` may do with `target`'s data.
 * Pure and synchronous: the API loads the nodes, this decides.
 */
export function resolveAccess(viewer: GroupNode, target: GroupNode, lookup: GroupLookup): Access {
  if (viewer.id === target.id) return "OWN";
  if (!isStrictDescendant(target.path, viewer.path)) return "NONE"; // sibling, ancestor, unrelated

  switch (viewer.level) {
    case "PROVINCE":
      return "MONITOR_AGGREGATE"; // always, regardless of suffragan settings

    case "ARCHDIOCESE": {
      const suffragan = firstBelowOfLevel(viewer, target, "DIOCESE", lookup);
      if (!suffragan) return "MONITOR_AGGREGATE"; // archdiocese's own deaneries/parishes
      const vis = suffragan.metropolitanVisibility ?? DEFAULT_METROPOLITAN_VISIBILITY;
      if (vis === "hidden") return "NONE";
      if (vis === "detailed") return "MONITOR_DETAILED";
      return "MONITOR_AGGREGATE";
    }

    case "DIOCESE":
      return "MONITOR_AGGREGATE";

    case "DEANERY":
      return "MONITOR_DETAILED";

    case "PARISH":
      return target.level === "OUTSTATION" ? "OVERSIGHT" : "NONE";

    default:
      return "NONE"; // OUTSTATION has no descendants; VATICAN/NUNCIATURE are out of scope
  }
}

/** First group of `level` on the path below the viewer (target included). Fails closed on a missing node. */
function firstBelowOfLevel(
  viewer: GroupNode,
  target: GroupNode,
  level: HierarchyLevel,
  lookup: GroupLookup,
): GroupNode | undefined {
  const start = pathIds(viewer.path).length;
  for (const id of pathIds(target.path).slice(start)) {
    const node = id === target.id ? target : lookup(id);
    if (!node) throw new Error(`resolveAccess: group ${id} on path ${target.path} not loaded`);
    if (node.level === level) return node;
  }
  return undefined;
}

/** Capabilities implied by an access level. */
export const canWrite = (a: Access) => a === "OWN";
export const canApprove = (a: Access) => a === "OVERSIGHT";
export const canReadRecords = (a: Access) => a === "OWN" || a === "OVERSIGHT";
export const canReadSummaries = (a: Access) =>
  a === "OWN" || a === "OVERSIGHT" || a === "MONITOR_DETAILED";
export const canReadAggregates = (a: Access) => a !== "NONE";
