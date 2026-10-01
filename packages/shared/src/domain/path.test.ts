import { describe, expect, it } from "vitest";
import { buildPath, descendantsLikePattern, isStrictDescendant, pathIds } from "./path";
import { isValidParent } from "./levels";

describe("path", () => {
  it("builds root and child paths", () => {
    expect(buildPath(null, "a")).toBe("/a/");
    expect(buildPath("/a/", "b")).toBe("/a/b/");
  });
  it("rejects bad ids and malformed parents", () => {
    expect(() => buildPath(null, "a/b")).toThrow();
    expect(() => buildPath("a", "b")).toThrow();
  });
  it("detects strict descendants without prefix collisions", () => {
    expect(isStrictDescendant("/a/b/", "/a/")).toBe(true);
    expect(isStrictDescendant("/a/", "/a/")).toBe(false);
    expect(isStrictDescendant("/ab/", "/a/")).toBe(false); // trailing slash prevents this
  });
  it("splits ids and builds LIKE patterns", () => {
    expect(pathIds("/a/b/c/")).toEqual(["a", "b", "c"]);
    expect(descendantsLikePattern("/a/")).toBe("/a/_%");
  });
});

describe("hierarchy parents", () => {
  it.each([
    ["DIOCESE", "ARCHDIOCESE", true],
    ["DIOCESE", "PROVINCE", false],
    ["DEANERY", "ARCHDIOCESE", true],
    ["DEANERY", "DIOCESE", true],
    ["PARISH", "DEANERY", true],
    ["OUTSTATION", "PARISH", true],
    ["OUTSTATION", "DEANERY", false],
    ["PROVINCE", null, true],
    ["PARISH", null, false],
  ] as const)("%s under %s = %s", (child, parent, ok) => {
    expect(isValidParent(child, parent)).toBe(ok);
  });
});
