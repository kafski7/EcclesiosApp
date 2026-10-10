import { describe, expect, it } from "vitest";
import {
  compareFeasts,
  feastLabel,
  isValidFeast,
  saintsOn,
  slugify,
  type FeastEntry,
} from "./saints.js";

const s = (slug: string, m: number, d: number, rank: FeastEntry["rank"]): FeastEntry => ({
  slug,
  name: slug,
  feastMonth: m,
  feastDay: d,
  rank,
});

describe("feast dates", () => {
  it("validates month/day, allowing 29 February", () => {
    expect(isValidFeast(2, 29)).toBe(true);
    expect(isValidFeast(2, 30)).toBe(false);
    expect(isValidFeast(4, 31)).toBe(false);
    expect(isValidFeast(13, 1)).toBe(false);
  });
  it("labels and slugs", () => {
    expect(feastLabel(10, 1)).toBe("1 October");
    expect(slugify("Thérèse of Lisieux")).toBe("therese-of-lisieux");
    expect(slugify("Simon & Jude, Apostles")).toBe("simon-and-jude-apostles");
  });
});

describe("saint of the day", () => {
  const all = [
    s("optional", 10, 5, "OPTIONAL_MEMORIAL"),
    s("memorial", 10, 4, "MEMORIAL"),
    s("feast", 9, 29, "FEAST"),
    s("solemnity", 6, 29, "SOLEMNITY"),
    s("other-optional", 10, 4, "OPTIONAL_MEMORIAL"),
  ];
  it("picks the highest rank of the day", () => {
    expect(saintsOn(all, "2026-10-04").map((x) => x.slug)).toEqual(["memorial", "other-optional"]);
    expect(saintsOn(all, "2026-06-29")[0]!.slug).toBe("solemnity");
  });
  it("is empty on days with no entry", () => {
    expect(saintsOn(all, "2026-10-03")).toEqual([]);
  });
  it("sorts the directory in calendar order", () => {
    expect([...all].sort(compareFeasts).map((x) => x.slug)).toEqual([
      "solemnity",
      "feast",
      "memorial",
      "other-optional",
      "optional",
    ]);
  });
});
