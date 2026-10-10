import { describe, expect, it } from "vitest";
import { applyToggle, createBatcher, shareNote } from "./engage";

describe("engagement batcher (D-035)", () => {
  it("sends keys requested in the same tick as one request, in chunks", async () => {
    const calls: string[][] = [];
    const load = createBatcher(async (keys) => {
      calls.push(keys);
      return keys.map((key) => ({ key, likes: 1, liked: false, saved: false }));
    }, 2);
    const r = await Promise.all(["A", "B", "A", "C"].map(load));
    expect(calls).toEqual([["A", "B"], ["C"]]);
    expect(r.map((x) => x.key)).toEqual(["A", "B", "A", "C"]);
  });
  it("fills in missing keys with zero", async () => {
    const load = createBatcher(async () => []);
    expect(await load("X")).toEqual({ key: "X", likes: 0, liked: false, saved: false });
  });
});

describe("applyToggle — optimistic like/save (D-035, D-043)", () => {
  const base = { key: "HYMN:1", likes: 4, liked: false, saved: false };
  it("liking adds one, unliking removes one", () => {
    const liked = applyToggle(base, "like", true);
    expect(liked).toMatchObject({ liked: true, likes: 5 });
    expect(applyToggle(liked, "like", false)).toMatchObject({ liked: false, likes: 4 });
  });
  it("repeating the current state changes nothing (double taps)", () => {
    expect(applyToggle(base, "like", false)).toBe(base);
  });
  it("never goes below zero", () => {
    expect(applyToggle({ ...base, likes: 0, liked: true }, "like", false).likes).toBe(0);
  });
  it("save flips only saved", () => {
    expect(applyToggle(base, "save", true)).toEqual({ ...base, saved: true });
  });
});

describe("shareNote", () => {
  it("says what happened", () => {
    expect(shareNote("copied")).toBe("Link copied");
    expect(shareNote("shared")).toBeNull();
    expect(shareNote("failed")).toMatch(/Couldn't share/);
  });
});
