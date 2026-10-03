import { describe, expect, it } from "vitest";
import { lintLesson } from "@ecclesios/shared/domain";
import { SEED_NEWS } from "./news";

describe("news seed (D-032)", () => {
  it("bodies parse with no problems and one item is pinned", () => {
    for (const n of SEED_NEWS) expect(lintLesson(n.body)).toEqual([]);
    expect(SEED_NEWS.filter((n) => n.pinned).length).toBe(1);
  });
});
