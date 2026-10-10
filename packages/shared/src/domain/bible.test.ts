import { describe, expect, it } from "vitest";
import {
  CANON,
  chapterInTranslation,
  findBook,
  hebrewToVulgatePsalm,
  highlightedVerses,
  normalizeBookCode,
  parseReference,
} from "./bible.js";

describe("canon", () => {
  it("is the 73-book Catholic canon in Catholic order", () => {
    expect(CANON.length).toBe(73);
    expect(CANON.filter((b) => b.testament === "NT").length).toBe(27);
    expect(CANON.filter((b) => b.deutero).map((b) => b.code)).toEqual([
      "TOB",
      "JDT",
      "1MA",
      "2MA",
      "WIS",
      "SIR",
      "BAR",
    ]);
    expect(CANON[16]!.code).toBe("TOB"); // after Nehemiah
    expect(new Set(CANON.map((b) => b.code)).size).toBe(73);
  });
  it("maps USFM ids, including Greek Esther", () => {
    expect(normalizeBookCode("esg")).toBe("EST");
    expect(normalizeBookCode("JHN")).toBe("JHN");
    expect(normalizeBookCode("FRT")).toBe(null);
  });
  it("finds books by name and abbreviation", () => {
    expect(findBook("Luke")).toBe("LUK");
    expect(findBook("1 Jn")).toBe("1JN");
    expect(findBook("I Corinthians")).toBe("1CO");
    expect(findBook("First Kings")).toBe("1KI");
    expect(findBook("Psalm")).toBe("PSA");
    expect(findBook("Song of Songs")).toBe("SNG");
    expect(findBook("2Macc")).toBe("2MA");
    expect(findBook("Hezekiah")).toBe(undefined);
  });
});

describe("parseReference", () => {
  it("single range", () => {
    expect(parseReference("Luke 10:13-16")).toEqual({
      book: "LUK",
      ranges: [{ chapter: 10, from: 13, to: 16 }],
    });
  });
  it("lists and several chapters", () => {
    expect(parseReference("Job 38:1, 12-21; 40:3-5")).toEqual({
      book: "JOB",
      ranges: [
        { chapter: 38, from: 1, to: 1 },
        { chapter: 38, from: 12, to: 21 },
        { chapter: 40, from: 3, to: 5 },
      ],
    });
  });
  it("whole chapters, verse letters and dashes", () => {
    expect(parseReference("Psalm 23")).toEqual({
      book: "PSA",
      ranges: [{ chapter: 23, from: null, to: null }],
    });
    expect(parseReference("Isaiah 9:1-6a")!.ranges).toEqual([{ chapter: 9, from: 1, to: 6 }]);
    expect(parseReference("Mt 26:14—27:66")!.ranges).toEqual([
      { chapter: 26, from: 14, to: null },
      { chapter: 27, from: 1, to: 66 },
    ]);
  });
  it("numbered books and bad input", () => {
    expect(parseReference("1 John 3:2")).toEqual({
      book: "1JN",
      ranges: [{ chapter: 3, from: 2, to: 2 }],
    });
    expect(parseReference("Hezekiah 1:1")).toBe(null);
    expect(parseReference("Luke ten")).toBe(null);
  });
  it("highlights verses per chapter", () => {
    const ref = parseReference("Job 38:1, 12-14; 40:3-5")!;
    expect([...highlightedVerses(ref, 38)!]).toEqual([1, 12, 13, 14]);
    expect(highlightedVerses(ref, 39)!.size).toBe(0);
    expect(highlightedVerses(parseReference("Psalm 23")!, 23)).toBe(null);
  });
});

describe("psalm numbering (D-024)", () => {
  it.each([
    [1, undefined, 1],
    [9, undefined, 9],
    [10, undefined, 9],
    [23, undefined, 22],
    [51, undefined, 50],
    [113, undefined, 112],
    [114, undefined, 113],
    [115, undefined, 113],
    [116, 1, 114],
    [116, 12, 115],
    [130, undefined, 129],
    [147, 1, 146],
    [147, 15, 147],
    [150, undefined, 150],
  ] as const)("Hebrew %s (verse %s) → Vulgate %s", (h, v, vg) => {
    expect(hebrewToVulgatePsalm(h, v)).toBe(vg);
  });
  it("only psalms in Vulgate-numbered translations move", () => {
    expect(chapterInTranslation("PSA", 23, "VULGATE")).toEqual({ chapter: 22, exact: false });
    expect(chapterInTranslation("PSA", 23, "HEBREW")).toEqual({ chapter: 23, exact: true });
    expect(chapterInTranslation("LUK", 10, "VULGATE")).toEqual({ chapter: 10, exact: true });
  });
});
