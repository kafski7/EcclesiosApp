import { describe, expect, it } from "vitest";
import {
  continueItems,
  leftLabel,
  type BibleProgress,
  type BookProgress,
  type EpisodeProgress,
} from "./continue";

const NOW = Date.parse("2026-10-09T12:00:00Z");
const H = 3_600_000;
const ep = (over: Partial<EpisodeProgress> = {}): EpisodeProgress => ({
  episodeId: "e1",
  title: "Episode",
  podcastTitle: "Pod",
  podcastSlug: "pod",
  coverUrl: null,
  durationSec: 1800,
  position: 600,
  at: NOW - H,
  ...over,
});
const book = (over: Partial<BookProgress> = {}): BookProgress => ({
  slug: "confessions",
  title: "Confessions",
  authorName: "St Augustine",
  coverUrl: null,
  percent: 40,
  lastReadAt: new Date(NOW - 2 * H).toISOString(),
  ...over,
});
const bible = (over: Partial<BibleProgress> = {}): BibleProgress => ({
  book: "JHN",
  bookName: "John",
  chapter: 6,
  translation: "WEBC",
  at: NOW - 3 * H,
  ...over,
});

describe("continueItems (D-044)", () => {
  it("orders by most recent and keeps at most three", () => {
    const r = continueItems(
      {
        episode: ep(),
        books: [
          book(),
          book({ slug: "b2", lastReadAt: new Date(NOW - 30 * 60_000).toISOString() }),
        ],
        bible: bible(),
      },
      NOW,
    );
    expect(r.map((x) => x.key)).toEqual(["b:b2", "e:e1", "b:confessions"]);
  });
  it("skips barely-started and finished episodes", () => {
    expect(continueItems({ episode: ep({ position: 10 }), books: [], bible: null }, NOW)).toEqual(
      [],
    );
    expect(continueItems({ episode: ep({ position: 1790 }), books: [], bible: null }, NOW)).toEqual(
      [],
    );
  });
  it("reports time left, or none when the length is unknown", () => {
    expect(continueItems({ episode: ep(), books: [], bible: null }, NOW)[0]).toMatchObject({
      leftSec: 1200,
    });
    expect(
      continueItems({ episode: ep({ durationSec: null }), books: [], bible: null }, NOW)[0],
    ).toMatchObject({ leftSec: null });
  });
  it("keeps undated (older saved) progress, after dated items", () => {
    const r = continueItems({ episode: ep({ at: null }), books: [], bible: bible() }, NOW);
    expect(r.map((x) => x.kind)).toEqual(["BIBLE", "EPISODE"]);
  });
  it("skips unstarted, finished and never-opened books", () => {
    const books = [book({ percent: 0 }), book({ percent: 100 }), book({ lastReadAt: null })];
    expect(continueItems({ episode: null, books, bible: null }, NOW)).toEqual([]);
  });
  it("drops anything older than 30 days", () => {
    const old = NOW - 31 * 24 * H;
    expect(
      continueItems(
        {
          episode: ep({ at: old }),
          books: [book({ lastReadAt: new Date(old).toISOString() })],
          bible: bible({ at: old }),
        },
        NOW,
      ),
    ).toEqual([]);
  });
});

describe("leftLabel", () => {
  it("is short and human", () => {
    expect(leftLabel(20)).toBe("under a minute left");
    expect(leftLabel(720)).toBe("12 min left");
    expect(leftLabel(3900)).toBe("1 h 5 min left");
    expect(leftLabel(7200)).toBe("2 h left");
  });
});
