import { describe, expect, it } from "vitest";
import { fileContentType, parseNumbers, versesFromText, versesToText } from "./hymnal";

describe("verse editor format", () => {
  const text = "Line one\nLine two\n\nR: Refrain a\nRefrain b\n\nThird\n";
  it("numbers stanzas and keeps the refrain", () => {
    expect(versesFromText(text)).toEqual([
      { label: "1", lines: ["Line one", "Line two"] },
      { label: "R", lines: ["Refrain a", "Refrain b"] },
      { label: "2", lines: ["Third"] },
    ]);
  });
  it("round-trips", () => {
    expect(versesFromText(versesToText(versesFromText(text)))).toEqual(versesFromText(text));
  });
});

describe("numbers and files", () => {
  it("parses book numbers", () => {
    expect(parseNumbers("NCH 56, ch12a; bogus")).toEqual({
      numbers: [{ book: "NCH", number: "56" }, { book: "CH", number: "12a" }],
      bad: ["bogus"],
    });
  });
  it("guesses MIDI type from the extension", () => {
    expect(fileContentType({ type: "", name: "x.MID" }, "MIDI")).toBe("audio/midi");
    expect(fileContentType({ type: "audio/mpeg", name: "x.mp3" }, "AUDIO")).toBe("audio/mpeg");
  });
});
