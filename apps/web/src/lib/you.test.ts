import { describe, expect, it } from "vitest";
import { groupByDay, libraryLabel, savedHref, sortLibrary } from "./you";

const ID = "00000000-0000-4000-8000-000000000001";

describe("savedHref (D-049)", () => {
  it("opens saved episodes on their own page", () => {
    expect(savedHref({ kind: "EPISODE", id: ID, href: "/podcasts/faith-talk" })).toBe(`/podcasts/faith-talk/episodes/${ID}`);
  });
  it("leaves other kinds and unexpected links alone", () => {
    expect(savedHref({ kind: "HYMN", id: ID, href: "/hymnal/abide" })).toBe("/hymnal/abide");
    expect(savedHref({ kind: "EPISODE", id: ID, href: "/podcasts/x/episodes/y" })).toBe("/podcasts/x/episodes/y");
  });
});

describe("library order", () => {
  const b = (slug: string, percent: number, lastReadAt: string | null, addedAt = "2026-09-01T00:00:00Z") => ({ slug, percent, lastReadAt, addedAt });
  it("reading first (recent), then unstarted (newest), then finished", () => {
    const r = sortLibrary([
      b("done", 100, "2026-10-08T00:00:00Z"),
      b("new", 0, null, "2026-10-05T00:00:00Z"),
      b("old-read", 30, "2026-10-01T00:00:00Z"),
      b("recent-read", 60, "2026-10-07T00:00:00Z"),
      b("older-new", 0, null, "2026-09-02T00:00:00Z"),
    ]);
    expect(r.map((x) => x.slug)).toEqual(["recent-read", "old-read", "new", "older-new", "done"]);
  });
  it("labels", () => {
    expect([libraryLabel(0), libraryLabel(42), libraryLabel(100)]).toEqual(["Not started", "42% read", "Finished"]);
  });
});

describe("groupByDay", () => {
  const now = new Date(2026, 9, 9, 15, 0); // Fri 9 Oct 2026, 15:00 local
  const at = (d: number, h = 9) => ({ createdAt: new Date(2026, 9, d, h).toISOString() });
  it("groups newest-first items under day headings", () => {
    const g = groupByDay([at(9, 14), at(9, 1), at(8), at(5), at(3), at(1)], now);
    expect(g.map((x) => [x.label, x.items.length])).toEqual([
      ["Today", 2],
      ["Yesterday", 1],
      ["Earlier this week", 2],
      ["Older", 1],
    ]);
  });
  it("empty in, empty out", () => expect(groupByDay([], now)).toEqual([]));
});
