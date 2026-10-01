import { Inject, Injectable } from "@nestjs/common";
import { groupSettings, groups } from "@ecclesios/db";
import { pathIds, resolveAccess, type Access, type GroupNode } from "@ecclesios/shared/domain";
import { eq, inArray } from "drizzle-orm";
import { DB, type Database } from "../db/db.module";

/**
 * Loads the viewer, the target and every group on the target's path in ONE query
 * (materialised path, D-005), then lets the pure resolveAccess decide.
 */
@Injectable()
export class ScopeService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async resolve(viewerGroupId: string, targetGroupId: string): Promise<Access> {
    if (viewerGroupId === targetGroupId) return "OWN";
    const [target] = await this.db
      .select({ path: groups.path })
      .from(groups)
      .where(eq(groups.id, targetGroupId))
      .limit(1);
    if (!target) return "NONE";

    const ids = [...new Set([...pathIds(target.path), viewerGroupId])];
    const rows = await this.db
      .select({
        id: groups.id,
        level: groups.level,
        path: groups.path,
        vis: groupSettings.metropolitanVisibility,
      })
      .from(groups)
      .leftJoin(groupSettings, eq(groupSettings.groupId, groups.id))
      .where(inArray(groups.id, ids));

    const nodes = new Map<string, GroupNode>(
      rows.map((r) => [r.id, { id: r.id, level: r.level, path: r.path, metropolitanVisibility: r.vis ?? undefined }]),
    );
    const viewer = nodes.get(viewerGroupId);
    const node = nodes.get(targetGroupId);
    if (!viewer || !node) return "NONE";
    try {
      return resolveAccess(viewer, node, (id) => nodes.get(id));
    } catch {
      return "NONE"; // fail closed (e.g. inconsistent path)
    }
  }
}
