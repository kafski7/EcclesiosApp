import { Inject, Injectable } from "@nestjs/common";
import { groups } from "@ecclesios/db";
import type { ChurchOption, ChurchRef } from "@ecclesios/shared";
import { JOINABLE_LEVELS, pathIds } from "@ecclesios/shared/domain";
import { and, asc, eq, ilike, inArray, or } from "drizzle-orm";
import { NotifyService } from "../notify/notify.service";
import { DB, type Database } from "../db/db.module";
import { ancestorIds, describeChurch, type NamedNode } from "../registration/parish-label";

/** Joinable churches (parishes + outstations) and who approves requests to them (D-014, D-016). */
@Injectable()
export class ChurchesService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly notify: NotifyService,
  ) {}

  /** Active parishes and outstations matching `q` (name or code), with context. Max 20. */
  async search(q: string): Promise<ChurchOption[]> {
    const term = escapeLike(q.trim());
    const rows = await this.db
      .select({ id: groups.id, name: groups.name, path: groups.path, level: groups.level })
      .from(groups)
      .where(
        and(
          inArray(groups.level, [...JOINABLE_LEVELS]),
          eq(groups.isActive, true),
          term ? or(ilike(groups.name, `%${term}%`), ilike(groups.code, `${term}%`)) : undefined,
        ),
      )
      .orderBy(asc(groups.name))
      .limit(20);
    if (!rows.length) return [];
    const ids = ancestorIds(rows.map((r) => r.path));
    const ancestors = ids.length
      ? await this.db
          .select({ id: groups.id, name: groups.name, level: groups.level })
          .from(groups)
          .where(inArray(groups.id, ids))
      : [];
    const byId = new Map<string, NamedNode>(ancestors.map((a) => [a.id, a]));
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      level: r.level as "PARISH" | "OUTSTATION",
      ...describeChurch(r.path, r.level, byId),
    }));
  }

  /** The church if it exists, is active and joinable; otherwise null. */
  async findJoinable(id: string): Promise<(ChurchRef & { path: string }) | null> {
    const [g] = await this.db
      .select({ id: groups.id, name: groups.name, level: groups.level, path: groups.path })
      .from(groups)
      .where(
        and(
          eq(groups.id, id),
          eq(groups.isActive, true),
          inArray(groups.level, [...JOINABLE_LEVELS]),
        ),
      )
      .limit(1);
    return g ?? null;
  }

  /**
   * Notify whoever can approve a request to `church`: its active Administrators, and for an
   * outstation also the overseeing parish's (backup approver, D-016). Never throws.
   */
  async notifyApprovers(church: ChurchRef & { path: string }, title: string, link: string) {
    const ids = pathIds(church.path);
    const approverGroups =
      church.level === "OUTSTATION" ? [church.id, ids[ids.length - 2]!] : [church.id];
    await this.notify.staff("MEMBER_REGISTRATION", approverGroups, ["ADMINISTRATOR"], { title, link }, church.id);
  }
}

/** Treat user input literally inside LIKE patterns. */
export const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
