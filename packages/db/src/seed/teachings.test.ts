import { describe, expect, it } from "vitest";
import { lintLesson } from "@ecclesios/shared/domain";
import { SEED_TEACHINGS, TEACHING_TOPICS } from "./teachings";

describe("teachings seed (D-030)", () => {
  const slugs = new Set(SEED_TEACHINGS.map((t) => t.slug));
  const topics = new Set<string>(TEACHING_TOPICS.map((t) => t.slug));
  it("every lesson parses with no problems", () => {
    for (const t of SEED_TEACHINGS) expect(lintLesson(t.body, slugs)).toEqual([]);
  });
  it("topics and related links point at real entries", () => {
    for (const t of SEED_TEACHINGS) {
      expect(t.topics.length).toBeGreaterThan(0);
      for (const x of t.topics) expect(topics.has(x)).toBe(true);
      for (const r of t.related) expect(slugs.has(r)).toBe(true);
    }
  });
  it("summaries fit", () => {
    for (const t of SEED_TEACHINGS) expect(t.summary.length).toBeLessThan(301);
  });
});
