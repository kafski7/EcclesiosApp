import { describe, expect, it } from "vitest";
import { parseUsfm } from "./usfm.js";

// Synthetic USFM (not real Bible text) exercising the markers the importer must handle.
const SAMPLE = String.raw`\id LUK Sample
\h Luke
\c 1
\s1 A heading that must not appear
\p
\v 1 First \w verse|strong="G1"\w* text.\f + \fr 1:1 \ft A footnote.\f*
\v 2 Second verse
\q1 continues on a poetry line.
\c 2
\p
\v 1 He said, \wj Peace be with you.\wj*
\v 2-3 A bridged verse \x - \xo 2:2 \xt Mt 1:1\x* here.`;

describe("parseUsfm", () => {
  const book = parseUsfm(SAMPLE)!;
  it("reads book code, chapters and verses", () => {
    expect(book.code).toBe("LUK");
    expect(book.verses.map((v) => `${v.chapter}:${v.verse}`)).toEqual(["1:1", "1:2", "2:1", "2:2"]);
  });
  it("drops notes, headings, cross-references and word attributes", () => {
    expect(book.verses[0]!.text).toBe("First verse text.");
    expect(book.verses[1]!.text).toBe("Second verse continues on a poetry line.");
    expect(book.verses[3]!.text).toBe("A bridged verse here.");
  });
  it("marks words of Jesus", () => {
    const v = book.verses[2]!;
    expect(v.text).toBe("He said, Peace be with you.");
    const [a, b] = v.woj[0]!;
    expect(v.text.slice(a, b).trim()).toBe("Peace be with you.");
  });
  it("skips non-canonical files", () => {
    expect(parseUsfm(String.raw`\id FRT Front matter`)).toBe(null);
  });
});
