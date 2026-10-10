import { describe, expect, it } from "vitest";
import { coverInitials, formatEpisodeDuration, episodePath, otherEpisodes } from "./podcasts";

describe("podcast helpers", () => {
  it("cover initials", () => {
    expect(coverInitials("Ecclesios Weekly")).toBe("EW");
    expect(coverInitials("Youth on Fire")).toBe("YO");
  });
  it("durations", () => {
    expect(formatEpisodeDuration(600)).toBe("10:00");
  });
});

describe("episode pages (D-045)", () => {
  it("builds the path", () =>
    expect(episodePath("faith-talk", "e1")).toBe("/podcasts/faith-talk/episodes/e1"));
  it("suggests neighbours first, newest list order", () => {
    const all = ["a", "b", "c", "d", "e", "f", "g"].map((id) => ({ id }));
    expect(otherEpisodes(all, "d", 4).map((e) => e.id)).toEqual(["e", "c", "f", "b"]);
    expect(otherEpisodes(all, "a", 3).map((e) => e.id)).toEqual(["b", "c", "d"]);
    expect(otherEpisodes(all, "zz", 2).map((e) => e.id)).toEqual(["a", "b"]);
    expect(otherEpisodes([{ id: "a" }], "a")).toEqual([]);
  });
});
