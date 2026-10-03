/**
 * Home (functionality §3.1, D-033): hymn of the day, trending posts and the blended feed.
 * Pure and deterministic, so every server and every test agrees on "today's" picks.
 */
import { liturgicalDay, type LiturgicalSeason } from "./liturgy.js";

// ------------------------------------------------------------------ hymn of the day

/** Season → the hymnal tag that belongs to it (D-026 tags). Ordinary Time has none. */
export const SEASON_TAG: Record<LiturgicalSeason, string | null> = {
  ADVENT: "advent",
  CHRISTMAS: "christmas",
  LENT: "lent",
  TRIDUUM: "lent",
  EASTER: "easter",
  ORDINARY: null,
};
const SEASONAL_TAGS = new Set(["advent", "christmas", "lent", "easter"]);

/** Small, stable string hash (FNV-1a) — same result on every machine. */
export function stableHash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export interface HymnCandidate {
  slug: string;
  tags: readonly string[];
}

/**
 * Hymn of the day for a date: a hymn of the current season if there is one; in Ordinary Time,
 * any hymn that is NOT purely seasonal (no Christmas carols in July). Picks by date hash, so it
 * changes daily and is the same for everyone. `pinned` (a Super-Admin choice) wins.
 */
export function hymnOfDay<T extends HymnCandidate>(all: readonly T[], date: string, pinned?: string | null): T | null {
  if (pinned) {
    const p = all.find((h) => h.slug === pinned);
    if (p) return p;
  }
  const tag = SEASON_TAG[liturgicalDay(date).season];
  const seasonal = tag ? all.filter((h) => h.tags.includes(tag)) : [];
  const ordinary = all.filter((h) => !h.tags.some((t) => SEASONAL_TAGS.has(t)));
  const pool = (seasonal.length ? seasonal : ordinary.length ? ordinary : all)
    .slice()
    .sort((a, b) => a.slug.localeCompare(b.slug));
  if (!pool.length) return null;
  return pool[stableHash(date) % pool.length]!;
}

// ------------------------------------------------------------------ trending

export const TRENDING_WINDOW_DAYS = 14;
export const TRENDING_ACTIVITY_HOURS = 72;

/**
 * Trending score (Hacker-News style): recent comments and likes push a post up, age pulls it down.
 * score = (recentComments × 3 + recentLikes + 1) / (hoursSincePublished + 2)^1.2
 * A comment weighs three likes (D-035).
 * Gentler gravity than HN (1.8) because a parish community is small: a post with a few
 * comments yesterday should still beat one nobody has answered yet.
 */
export function trendingScore(recentComments: number, publishedAt: Date, now: Date, recentLikes = 0): number {
  const hours = Math.max(0, (now.getTime() - publishedAt.getTime()) / 3_600_000);
  return (recentComments * 3 + recentLikes + 1) / Math.pow(hours + 2, 1.2);
}

export function rankTrending<T extends { id: string; publishedAt: Date; recentComments: number; recentLikes?: number }>(
  rows: readonly T[],
  now: Date,
  limit = 5,
): T[] {
  const cutoff = now.getTime() - TRENDING_WINDOW_DAYS * 86_400_000;
  return rows
    .filter((r) => r.publishedAt.getTime() >= cutoff && r.publishedAt <= now)
    .map((r) => ({ r, s: trendingScore(r.recentComments, r.publishedAt, now, r.recentLikes ?? 0) }))
    .sort((a, b) => b.s - a.s || b.r.publishedAt.getTime() - a.r.publishedAt.getTime() || a.r.id.localeCompare(b.r.id))
    .slice(0, limit)
    .map((x) => x.r);
}

// ------------------------------------------------------------------ blended feed

export const FEED_ITEM_TYPES = ["POST", "TEACHING", "EPISODE", "NEWS"] as const;
export type FeedItemType = (typeof FEED_ITEM_TYPES)[number];

export interface FeedEntry {
  type: FeedItemType;
  /** Stable id within its type. */
  key: string;
  at: Date;
}

/**
 * Merge per-source lists (each already newest-first) into one page, newest first.
 * Each source must supply at least `page × size` items for the page to be exact.
 */
export function mergeFeed<T extends FeedEntry>(sources: readonly (readonly T[])[], page: number, size: number) {
  const all = sources
    .flat()
    .slice()
    .sort((a, b) => b.at.getTime() - a.at.getTime() || a.type.localeCompare(b.type) || a.key.localeCompare(b.key));
  const start = (page - 1) * size;
  return { items: all.slice(start, start + size), hasMore: all.length > start + size };
}

// ------------------------------------------------------------------ watch row (D-034)

export const WATCH_KINDS = ["EPISODE", "POST", "HYMN"] as const;
export type WatchKind = (typeof WATCH_KINDS)[number];
export const WATCH_ROW_MAX = 12;
/** Per source, so one busy source can't fill the whole row. */
export const WATCH_PER_KIND_MAX = 6;

export interface WatchCandidate {
  kind: WatchKind;
  key: string;
  youtubeId: string;
  at: Date;
}

/**
 * The Home "Watch" row: newest videos across sources, at most WATCH_PER_KIND_MAX per kind,
 * each YouTube video once (the same clip can be on an episode and a post), at most `limit`.
 */
export function selectWatch<T extends WatchCandidate>(items: readonly T[], limit = WATCH_ROW_MAX): T[] {
  const seen = new Set<string>();
  const perKind = new Map<WatchKind, number>();
  const out: T[] = [];
  const sorted = [...items].sort((a, b) => b.at.getTime() - a.at.getTime() || a.kind.localeCompare(b.kind) || a.key.localeCompare(b.key));
  for (const it of sorted) {
    if (out.length >= limit) break;
    if (seen.has(it.youtubeId)) continue;
    const n = perKind.get(it.kind) ?? 0;
    if (n >= WATCH_PER_KIND_MAX) continue;
    seen.add(it.youtubeId);
    perKind.set(it.kind, n + 1);
    out.push(it);
  }
  return out;
}

/** YouTube's own thumbnail (no API key needed). */
export const youTubeThumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
