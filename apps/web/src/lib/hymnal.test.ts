import { describe, expect, it } from "vitest";
import { formatDuration, hymnSearchParams, numbersLabel, readerCountry } from "./hymnal";

describe("hymnal helpers", () => {
  it("reads the country from the browser language", () => {
    expect(readerCountry("en-GH")).toBe("GH");
    expect(readerCountry("fr_ci")).toBe("CI");
    expect(readerCountry("en")).toBeUndefined();
  });
  it("builds search params", () => {
    expect(hymnSearchParams({ q: " 56 ", book: "NCH", tag: null }, 2, "GH").toString()).toBe("q=56&book=NCH&country=GH&page=2");
  });
  it("labels", () => {
    expect(numbersLabel([{ book: "NCH", number: "56" }, { book: "CH", number: "12" }])).toBe("NCH 56 · CH 12");
    expect(formatDuration(125)).toBe("2:05");
    expect(formatDuration(null)).toBe("");
  });
});
