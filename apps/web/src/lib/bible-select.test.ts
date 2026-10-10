import { describe, expect, it } from "vitest";
import {
  displayRef,
  selectionLink,
  selectionRef,
  selectionText,
  verseRanges,
} from "./bible-select";

describe("verse selection (D-045)", () => {
  it("groups verses into ranges", () => {
    expect(verseRanges([20, 16, 18, 17, 16])).toEqual([
      [16, 18],
      [20, 20],
    ]);
    expect(verseRanges([])).toEqual([]);
    expect(verseRanges([0, -1, 2.5, 3])).toEqual([[3, 3]]);
  });
  it("writes a reference parseReference reads back", () => {
    expect(selectionRef("John", 3, [16, 17, 18, 20])).toBe("John 3:16-18, 20");
    expect(selectionRef("1 John", 4, [8])).toBe("1 John 4:8");
    expect(selectionRef("John", 3, [])).toBe("John 3");
    expect(displayRef("John 3:16-18, 20")).toBe("John 3:16–18, 20");
  });
  it("links with ?ref=, except Vulgate-numbered psalms", () => {
    expect(selectionLink("JHN", 3, "John 3:16-18", false)).toBe(
      "/bible/jhn/3?ref=John%203%3A16-18",
    );
    expect(selectionLink("PSA", 22, "Psalms 22:1", true)).toBe("/bible/psa/22");
  });
  it("copies the verses in order with the reference", () => {
    const verses = [
      { verse: 17, text: "For God didn't send his Son…" },
      { verse: 16, text: " For God so loved the world… " },
      { verse: 18, text: "unused" },
    ];
    expect(selectionText(verses, new Set([16, 17]), "John 3:16-17", "WEBC")).toBe(
      "16 For God so loved the world… 17 For God didn't send his Son…\n— John 3:16–17 (WEBC)",
    );
  });
});
