import { describe, expect, it } from "vitest";
import {
  hymnOfDay,
  mergeFeed,
  rankTrending,
  selectWatch,
  stableHash,
  trendingScore,
  WATCH_PER_KIND_MAX,
  youTubeThumb,
  type FeedEntry,
} from "./home.js";
import { isNewsCurrent, isNewsLive, orderNews } from "./news.js";

const HYMNS = [
  { slug: "silent-night", tags: ["christmas"] },
  { slug: "away-in-a-manger", tags: ["christmas"] },
  { slug: "o-come-o-come-emmanuel", tags: ["advent"] },
  { slug: "holy-god", tags: ["entrance"] },
  { slug: "faith-of-our-fathers", tags: [] },
];

describe("hymn of the day (D-033)", () => {
  it("is stable for a date and changes across days", () => {
    expect(hymnOfDay(HYMNS, "2026-10-04")).toBe(hymnOfDay(HYMNS, "2026-10-04"));
    const week = ["01", "02", "03", "04", "05", "06", "07"].map((d) => hymnOfDay(HYMNS, `2026-10-${d}`)!.slug);
    expect(new Set(week).size).toBeGreaterThan(1);
  });
  it("follows the season", () => {
    expect(hymnOfDay(HYMNS, "2026-12-01")!.slug).toBe("o-come-o-come-emmanuel"); // Advent
    expect(["silent-night", "away-in-a-manger"]).toContain(hymnOfDay(HYMNS, "2026-12-26")!.slug);
  });
  it("no seasonal hymns in Ordinary Time", () => {
    for (let d = 1; d <= 28; d++) {
      const day = `2026-10-${String(d).padStart(2, "0")}`;
      expect(["holy-god", "faith-of-our-fathers"]).toContain(hymnOfDay(HYMNS, day)!.slug);
    }
  });
  it("a pinned hymn wins; empty hymnal gives null", () => {
    expect(hymnOfDay(HYMNS, "2026-10-04", "silent-night")!.slug).toBe("silent-night");
    expect(hymnOfDay([], "2026-10-04")).toBe(null);
  });
  it("hash is deterministic", () => {
    expect(stableHash("2026-10-04")).toBe(stableHash("2026-10-04"));
  });
});

describe("trending", () => {
  const now = new Date("2026-10-03T12:00:00Z");
  const h = (n: number) => new Date(now.getTime() - n * 3_600_000);
  it("likes count, a comment weighs three likes", () => {
    expect(trendingScore(0, h(5), now, 3)).toBe(trendingScore(1, h(5), now, 0));
    expect(trendingScore(0, h(5), now, 4)).toBeGreaterThan(trendingScore(0, h(5), now));
  });
  it("recent activity beats age", () => {
    expect(trendingScore(5, h(24), now)).toBeGreaterThan(trendingScore(0, h(2), now));
  });
  it("ranks and drops posts older than the window", () => {
    const rows = [
      { id: "quiet", publishedAt: h(5), recentComments: 0 },
      { id: "busy", publishedAt: h(30), recentComments: 8 },
      { id: "old", publishedAt: h(24 * 20), recentComments: 50 },
    ];
    expect(rankTrending(rows, now).map((r) => r.id)).toEqual(["busy", "quiet"]);
  });
});

describe("mergeFeed", () => {
  const at = (iso: string) => new Date(iso);
  const posts: FeedEntry[] = [
    { type: "POST", key: "p2", at: at("2026-10-03") },
    { type: "POST", key: "p1", at: at("2026-09-30") },
  ];
  const teach: FeedEntry[] = [{ type: "TEACHING", key: "t1", at: at("2026-10-01") }];
  it("interleaves newest first and pages", () => {
    expect(mergeFeed([posts, teach], 1, 2)).toEqual({ items: [posts[0], teach[0]], hasMore: true });
    expect(mergeFeed([posts, teach], 2, 2).items).toEqual([posts[1]]);
  });
});

describe("news (D-032)", () => {
  const now = new Date("2026-10-03T12:00:00Z");
  it("live, current and expired", () => {
    const n = { status: "PUBLISHED" as const, publishedAt: new Date("2026-10-01"), expiresAt: new Date("2026-10-02") };
    expect(isNewsLive(n, now)).toBe(true);
    expect(isNewsCurrent(n, now)).toBe(false);
    expect(isNewsLive({ ...n, status: "DRAFT" }, now)).toBe(false);
    expect(isNewsLive({ ...n, publishedAt: new Date("2026-10-05") }, now)).toBe(false); // scheduled
  });
  it("pinned first", () => {
    const items = [
      { id: "a", pinned: false, publishedAt: new Date("2026-10-03") },
      { id: "b", pinned: true, publishedAt: new Date("2026-09-01") },
    ];
    expect(orderNews(items).map((x) => x.id)).toEqual(["b", "a"]);
  });
});


describe("selectWatch (D-034)", () => {
  const at = (d: number) => new Date(Date.UTC(2026, 9, d));
  it("newest first, each video once", () => {
    const r = selectWatch([
      { kind: "POST", key: "p1", youtubeId: "AAAAAAAAAAA", at: at(1) },
      { kind: "EPISODE", key: "e1", youtubeId: "AAAAAAAAAAA", at: at(3) },
      { kind: "HYMN", key: "h1", youtubeId: "BBBBBBBBBBB", at: at(2) },
    ]);
    expect(r.map((x) => x.key)).toEqual(["e1", "h1"]);
  });
  it("caps each kind and the row", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ kind: "POST" as const, key: `p${i}`, youtubeId: `id${i}`.padEnd(11, "x"), at: at(i + 1) }));
    expect(selectWatch(many).length).toBe(WATCH_PER_KIND_MAX);
    expect(selectWatch(many, 3).length).toBe(3);
  });
  it("thumbnails", () => {
    expect(youTubeThumb("dQw4w9WgXcQ")).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
  });
});
