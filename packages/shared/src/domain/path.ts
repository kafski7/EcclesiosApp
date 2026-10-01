/**
 * Materialised path helpers (blueprint §3.5).
 * A path is "/" + ancestor ids (root first) + own id + "/", e.g. "/p1/a1/d1/".
 * Ids must not contain "/" (UUIDs never do).
 */
export const ROOT_PATH = "/";

export function buildPath(parentPath: string | null, id: string): string {
  if (!id || id.includes("/")) throw new Error(`Invalid group id for path: ${id}`);
  const base = parentPath ?? ROOT_PATH;
  if (!base.startsWith("/") || !base.endsWith("/")) throw new Error(`Malformed path: ${base}`);
  return `${base}${id}/`;
}

/** Ids from root to self. */
export const pathIds = (path: string): string[] => path.split("/").filter(Boolean);

/** True if `path` is strictly below `ancestorPath`. */
export const isStrictDescendant = (path: string, ancestorPath: string): boolean =>
  path !== ancestorPath && path.startsWith(ancestorPath);

/** SQL LIKE pattern for "everything strictly below" (safe for UUID ids: no % or _ inside). */
export const descendantsLikePattern = (ancestorPath: string): string => `${ancestorPath}_%`;
