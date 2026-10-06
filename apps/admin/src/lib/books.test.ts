import { describe, expect, it } from "vitest";
import { bookFileType, bpsLabel } from "./books";

describe("console book helpers (D-036)", () => {
  it("labels commission", () => {
    expect([2000, 1750, 0, 1505].map(bpsLabel)).toEqual(["20%", "17.5%", "0%", "15.05%"]);
  });
  it("guesses book file types", () => {
    expect(bookFileType({ type: "", name: "My Book.EPUB" })).toBe("application/epub+zip");
    expect(bookFileType({ type: "application/pdf", name: "x" })).toBe("application/pdf");
  });
});
