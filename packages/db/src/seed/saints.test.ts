import { describe, expect, it } from "vitest";
import { isValidFeast, slugify } from "@ecclesios/shared/domain";
import { SEED_SAINTS } from "./saints";

describe("saints seed (D-025)", () => {
  it("every feast is a real date and every slug is unique", () => {
    for (const s of SEED_SAINTS) expect(isValidFeast(s.feast[0], s.feast[1])).toBe(true);
    const slugs = SEED_SAINTS.map((s) => slugify(s.name));
    expect(new Set(slugs).size).toBe(slugs.length);
  });
  it("summaries and biographies fit the schema limits", () => {
    for (const s of SEED_SAINTS) {
      expect(s.summary.length).toBeLessThan(281);
      expect(s.biography.length).toBeGreaterThan(0);
    }
  });
  it("covers the African saints and the period around the seed date", () => {
    const names = SEED_SAINTS.map((s) => s.name);
    for (const n of ["Charles Lwanga and Companions", "Josephine Bakhita", "Augustine", "Perpetua and Felicity"]) expect(names).toContain(n);
    expect(SEED_SAINTS.filter((s) => s.feast[0] === 10).length).toBeGreaterThanOrEqual(10);
  });
});
