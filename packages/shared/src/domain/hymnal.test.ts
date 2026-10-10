import { describe, expect, it } from "vitest";
import {
  canOpenMedia,
  defaultMediaAccess,
  hymnDisplayTitle,
  hymnNumberKey,
  orderBookNumbers,
  parseHymnQuery,
  youTubeId,
} from "./hymnal.js";

const BOOKS = { nch: "NCH", new: "NCH", ch: "CH", old: "CH" };

describe("parseHymnQuery (D-026)", () => {
  it("number alone, or with a book", () => {
    expect(parseHymnQuery("512", BOOKS)).toEqual({ book: null, number: "512", text: "" });
    expect(parseHymnQuery("NCH 512", BOOKS)).toEqual({ book: "NCH", number: "512", text: "" });
    expect(parseHymnQuery("ch246a", BOOKS)).toEqual({ book: "CH", number: "246a", text: "" });
    expect(parseHymnQuery("#056", BOOKS)).toEqual({ book: null, number: "56", text: "" });
  });
  it("anything else is text (first line, title, lyrics)", () => {
    expect(parseHymnQuery("  silent   night ", BOOKS).text).toBe("silent night");
    expect(parseHymnQuery("Psalm 23", BOOKS)).toEqual({
      book: null,
      number: null,
      text: "Psalm 23",
    });
    expect(parseHymnQuery("", BOOKS).text).toBe("");
  });
});

describe("numbers and ordering", () => {
  it("sorts numerically with letter suffixes", () => {
    expect(["10a", "2", "11", "10"].sort((a, b) => hymnNumberKey(a) - hymnNumberKey(b))).toEqual([
      "2",
      "10",
      "10a",
      "11",
    ]);
  });
  it("puts the reader's country first", () => {
    const rows = [
      { code: "X", bookCountry: "NG", bookOrder: 1 },
      { code: "NCH", bookCountry: "GH", bookOrder: 1 },
      { code: "CH", bookCountry: "GH", bookOrder: 2 },
    ];
    expect(orderBookNumbers(rows, "GH").map((r) => r.code)).toEqual(["NCH", "CH", "X"]);
  });
  it("derives a title from the first line", () => {
    expect(hymnDisplayTitle(null, "Silent night! Holy night!")).toBe("Silent night! Holy night");
    expect(hymnDisplayTitle("Adeste Fideles", "O come, all ye faithful,")).toBe("Adeste Fideles");
  });
});

describe("media access (D-026)", () => {
  it("default split: MIDI and default recording free; the rest for subscribers", () => {
    expect(defaultMediaAccess("MIDI", false)).toBe("FREE");
    expect(defaultMediaAccess("AUDIO", true)).toBe("FREE");
    expect(defaultMediaAccess("AUDIO", false)).toBe("SUBSCRIBER");
    expect(defaultMediaAccess("SOLFA_PDF", false)).toBe("SUBSCRIBER");
    expect(defaultMediaAccess("YOUTUBE", false)).toBe("SUBSCRIBER");
  });
  it("everything is open while the paywall is off", () => {
    expect(canOpenMedia("SUBSCRIBER", { subscribed: false, staff: false }, false)).toBe(true);
  });
  it("with the paywall on, subscribers and staff only", () => {
    expect(canOpenMedia("SUBSCRIBER", { subscribed: false, staff: false }, true)).toBe(false);
    expect(canOpenMedia("SUBSCRIBER", { subscribed: true, staff: false }, true)).toBe(true);
    expect(canOpenMedia("SUBSCRIBER", { subscribed: false, staff: true }, true)).toBe(true);
    expect(canOpenMedia("FREE", { subscribed: false, staff: false }, true)).toBe(true);
  });
});

describe("youTubeId", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://music.youtube.com/watch?v=dQw4w9WgXcQ&si=x", "dQw4w9WgXcQ"],
    ["https://m.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["dQw4w9WgXcQ", "dQw4w9WgXcQ"],
  ])("%s", (url, id) => {
    expect(youTubeId(url)).toBe(id);
  });
  it("rejects other sites and junk", () => {
    expect(youTubeId("https://vimeo.com/123")).toBe(null);
    expect(youTubeId("not a link")).toBe(null);
  });
});
