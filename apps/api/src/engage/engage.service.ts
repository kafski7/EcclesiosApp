import { Inject, Injectable } from "@nestjs/common";
import { hymns, podcastEpisodes, podcasts, posts, reactions, teachings } from "@ecclesios/db";
import type { EngageState, SavedItem } from "@ecclesios/shared";
import {
  engageHref,
  engageKey,
  hymnDisplayTitle,
  parseEngageKey,
  type EngageKind,
  type ReactionType,
} from "@ecclesios/shared/domain";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { DomainError } from "../auth/core/errors";
import { DB, type Database } from "../db/db.module";

const notFound = () => new DomainError(404, "ITEM_NOT_FOUND", "That item isn't available.");

/** Likes, saves and the Saved list (D-035). Members only; counts are public. */
@Injectable()
export class EngageService {
  constructor(@Inject(DB) private readonly db: Database) {}

  /** Ids of `ids` that are public right now, per kind. */
  private async liveIds(kind: EngageKind, ids: string[]): Promise<Set<string>> {
    if (!ids.length) return new Set();
    let rows: { id: string }[];
    switch (kind) {
      case "POST":
        rows = await this.db.select({ id: posts.id }).from(posts).where(and(inArray(posts.id, ids), eq(posts.status, "APPROVED")));
        break;
      case "TEACHING":
        rows = await this.db.select({ id: teachings.id }).from(teachings).where(and(inArray(teachings.id, ids), eq(teachings.status, "PUBLISHED")));
        break;
      case "EPISODE":
        rows = await this.db
          .select({ id: podcastEpisodes.id })
          .from(podcastEpisodes)
          .innerJoin(podcasts, eq(podcasts.id, podcastEpisodes.podcastId))
          .where(and(inArray(podcastEpisodes.id, ids), eq(podcastEpisodes.status, "PUBLISHED"), eq(podcasts.isPublished, true)));
        break;
      case "HYMN":
        rows = await this.db.select({ id: hymns.id }).from(hymns).where(and(inArray(hymns.id, ids), eq(hymns.isPublished, true)));
        break;
    }
    return new Set(rows.map((r) => r.id));
  }

  /** Like counts for any keys, plus the member's own liked / saved state. */
  async state(keys: string[], memberId: string | null): Promise<EngageState[]> {
    const parsed = keys.map(parseEngageKey).filter((x): x is { kind: EngageKind; id: string } => !!x);
    if (!parsed.length) return [];
    const byKind = new Map<EngageKind, string[]>();
    for (const p of parsed) byKind.set(p.kind, [...(byKind.get(p.kind) ?? []), p.id]);
    const match = sql.join(
      [...byKind].map(([kind, ids]) => sql`(${reactions.kind} = ${kind} and ${inArray(reactions.itemId, ids)})`),
      sql` or `,
    );
    const [counts, mine] = await Promise.all([
      this.db
        .select({ kind: reactions.kind, itemId: reactions.itemId, n: sql<number>`count(*)::int` })
        .from(reactions)
        .where(and(eq(reactions.type, "LIKE"), sql`(${match})`))
        .groupBy(reactions.kind, reactions.itemId),
      memberId
        ? this.db
            .select({ kind: reactions.kind, itemId: reactions.itemId, type: reactions.type })
            .from(reactions)
            .where(and(eq(reactions.memberId, memberId), sql`(${match})`))
        : Promise.resolve([] as { kind: EngageKind; itemId: string; type: ReactionType }[]),
    ]);
    return parsed.map(({ kind, id }) => ({
      key: engageKey(kind, id),
      likes: counts.find((c) => c.kind === kind && c.itemId === id)?.n ?? 0,
      liked: mine.some((m) => m.kind === kind && m.itemId === id && m.type === "LIKE"),
      saved: mine.some((m) => m.kind === kind && m.itemId === id && m.type === "SAVE"),
    }));
  }

  /** Set or clear a like / save. Idempotent. Only public items can be liked or saved. */
  async set(memberId: string, kind: EngageKind, itemId: string, type: ReactionType, on: boolean): Promise<EngageState> {
    if (on) {
      if (!(await this.liveIds(kind, [itemId])).has(itemId)) throw notFound();
      await this.db.insert(reactions).values({ memberId, kind, itemId, type }).onConflictDoNothing();
    } else {
      await this.db
        .delete(reactions)
        .where(and(eq(reactions.memberId, memberId), eq(reactions.kind, kind), eq(reactions.itemId, itemId), eq(reactions.type, type)));
    }
    return (await this.state([engageKey(kind, itemId)], memberId))[0]!;
  }

  /** The member's saved items, newest first; items no longer public are left out. */
  async saved(memberId: string): Promise<SavedItem[]> {
    const rows = await this.db
      .select()
      .from(reactions)
      .where(and(eq(reactions.memberId, memberId), eq(reactions.type, "SAVE")))
      .orderBy(desc(reactions.createdAt))
      .limit(500);
    const ids = (k: EngageKind) => rows.filter((r) => r.kind === k).map((r) => r.itemId);
    const [p, t, e, h] = await Promise.all([
      ids("POST").length
        ? this.db.select({ id: posts.id, title: posts.title, kind: posts.kind }).from(posts).where(and(inArray(posts.id, ids("POST")), eq(posts.status, "APPROVED")))
        : [],
      ids("TEACHING").length
        ? this.db.select({ id: teachings.id, title: teachings.title, slug: teachings.slug }).from(teachings).where(and(inArray(teachings.id, ids("TEACHING")), eq(teachings.status, "PUBLISHED")))
        : [],
      ids("EPISODE").length
        ? this.db
            .select({ id: podcastEpisodes.id, title: podcastEpisodes.title, podcastSlug: podcasts.slug, podcastTitle: podcasts.title })
            .from(podcastEpisodes)
            .innerJoin(podcasts, eq(podcasts.id, podcastEpisodes.podcastId))
            .where(and(inArray(podcastEpisodes.id, ids("EPISODE")), eq(podcastEpisodes.status, "PUBLISHED"), eq(podcasts.isPublished, true)))
        : [],
      ids("HYMN").length
        ? this.db.select({ id: hymns.id, slug: hymns.slug, title: hymns.title, firstLine: hymns.firstLine }).from(hymns).where(and(inArray(hymns.id, ids("HYMN")), eq(hymns.isPublished, true)))
        : [],
    ]);
    const out: SavedItem[] = [];
    for (const r of rows) {
      const at = r.createdAt.toISOString();
      if (r.kind === "POST") {
        const x = p.find((y) => y.id === r.itemId);
        if (x) out.push({ kind: "POST", id: x.id, title: x.title, subtitle: x.kind === "EVENT" ? "Event" : "Explore", href: engageHref("POST", x), savedAt: at });
      } else if (r.kind === "TEACHING") {
        const x = t.find((y) => y.id === r.itemId);
        if (x) out.push({ kind: "TEACHING", id: x.id, title: x.title, subtitle: "Teaching", href: engageHref("TEACHING", x), savedAt: at });
      } else if (r.kind === "EPISODE") {
        const x = e.find((y) => y.id === r.itemId);
        if (x) out.push({ kind: "EPISODE", id: x.id, title: x.title, subtitle: x.podcastTitle, href: engageHref("EPISODE", x), savedAt: at });
      } else {
        const x = h.find((y) => y.id === r.itemId);
        if (x) out.push({ kind: "HYMN", id: x.id, title: hymnDisplayTitle(x.title, x.firstLine), subtitle: "Hymn", href: engageHref("HYMN", x), savedAt: at });
      }
    }
    return out;
  }
}
