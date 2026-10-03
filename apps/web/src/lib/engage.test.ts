import { describe, expect, it } from "vitest";
import { createBatcher } from "./engage";

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
