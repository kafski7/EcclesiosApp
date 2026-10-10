import { describe, expect, it } from "vitest";
import { adjustForTranslation, chapterPath, readerLocation, verseSegments } from "./bible";

describe("readerLocation", () => {
  it("opens a Readings citation with verses highlighted", () => {
    const l = readerLocation({}, "Luke 10:13-16");
    expect(l.book).toBe("LUK");
    expect(l.chapter).toBe(10);
    expect([...l.highlight!]).toEqual([13, 14, 15, 16]);
  });
  it("uses the path, then falls back to John 1", () => {
    expect(readerLocation({ book: "gen", chapter: "3" }, null)).toEqual({
      book: "GEN",
      chapter: 3,
      highlight: null,
    });
    expect(readerLocation({ book: "xyz" }, "Nonsense 1:1")).toEqual({
      book: "JHN",
      chapter: 1,
      highlight: null,
    });
  });
  it("builds chapter paths", () => {
    expect(chapterPath("1CO", 13)).toBe("/bible/1co/13");
  });
});

describe("verseSegments", () => {
  it("splits words of Jesus", () => {
    expect(verseSegments("He said, Peace be with you.", [[9, 27]])).toEqual([
      { text: "He said, ", woj: false },
      { text: "Peace be with you.", woj: true },
    ]);
    expect(verseSegments("Plain.", [])).toEqual([{ text: "Plain.", woj: false }]);
  });
});

describe("adjustForTranslation (D-024)", () => {
  it("opens Psalm 23 from a reading as Psalm 22 in Douay-Rheims, without highlights", () => {
    const loc = readerLocation({}, "Psalm 23:1-4");
    expect(adjustForTranslation(loc, true, "VULGATE")).toEqual({
      book: "PSA",
      chapter: 22,
      highlight: null,
    });
    expect(adjustForTranslation(loc, true, "HEBREW")).toBe(loc);
  });
  it("leaves direct navigation alone", () => {
    const loc = readerLocation({ book: "psa", chapter: "23" }, null);
    expect(adjustForTranslation(loc, false, "VULGATE")).toBe(loc);
  });
});
