import { describe, expect, it } from "vitest";
import { slugify } from "@ecclesios/shared/domain";
import { HYMN_BOOKS, SEED_HYMNS } from "./hymnal";

describe("hymnal seed (D-026)", () => {
  const books = new Set(HYMN_BOOKS.map((b) => b.code));
  it("numbers point at seeded books and are unique per book", () => {
    const seen = new Set<string>();
    for (const h of SEED_HYMNS)
      for (const n of h.numbers) {
        expect(books.has(n.book)).toBe(true);
        expect(seen.has(`${n.book}:${n.number}`)).toBe(false);
        seen.add(`${n.book}:${n.number}`);
      }
  });
  it("each hymn has exactly one default tune and a verse", () => {
    for (const h of SEED_HYMNS) {
      expect(h.tunes.filter((t) => t.isDefault).length).toBe(1);
      expect(h.verses.length).toBeGreaterThan(0);
      expect(h.slug).toBe(slugify(h.slug));
    }
  });
  it("includes a hymn with two tunes", () => {
    expect(SEED_HYMNS.some((h) => h.tunes.length > 1)).toBe(true);
  });
});
