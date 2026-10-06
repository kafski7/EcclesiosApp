import { describe, expect, it } from "vitest";
import { MORE_ITEM, PRIMARY_NAV } from "./nav";

describe("primary navigation (blueprint §2.1)", () => {
  it("has the 10 sections in the documented order (Books added in D-036)", () => {
    expect([...PRIMARY_NAV, MORE_ITEM].map((n) => n.label)).toEqual([
      "Home",
      "Readings",
      "Saints",
      "Explore",
      "Podcasts",
      "Hymnal",
      "Teachings",
      "Books",
      "Bible",
      "More",
    ]);
  });
  it("uses unique routes", () => {
    const routes = [...PRIMARY_NAV, MORE_ITEM].map((n) => n.to);
    expect(new Set(routes).size).toBe(routes.length);
  });
});
