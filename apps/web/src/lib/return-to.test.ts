import { describe, expect, it } from "vitest";
import { currentAsNext, safeNext, withNext } from "./return-to";

describe("safeNext (no open redirects, D-043)", () => {
  it("keeps in-app paths with query and hash", () => {
    expect(safeNext("/hymnal/abide-with-me")).toBe("/hymnal/abide-with-me");
    expect(safeNext("/bible/jhn/3?ref=John%203%3A16#v16")).toBe(
      "/bible/jhn/3?ref=John%203%3A16#v16",
    );
  });
  it.each([
    null,
    undefined,
    "",
    "hymnal",
    "https://evil.example/x",
    "//evil.example",
    "/\\evil.example",
    "/\t/evil.example",
    "/ok\\..\\x",
    "javascript:alert(1)",
    " /x",
    "/" + "a".repeat(600),
  ])("rejects %j", (raw) => expect(safeNext(raw as string | null | undefined)).toBe("/"));
  it("never returns to the sign-in pages", () => {
    expect(safeNext("/login")).toBe("/");
    expect(safeNext("/register?next=/x")).toBe("/");
  });
  it("keeps percent-encoded tricks on this site (they're just path text → Not found)", () => {
    for (const raw of ["/%0a/evil", "/%2F%2Fevil.example", "/%5Cevil.example"]) {
      const out = safeNext(raw);
      expect(out.startsWith("/") && !out.startsWith("//") && !out.startsWith("/\\")).toBe(true);
      expect(new URL(out, "https://ecclesios.app").origin).toBe("https://ecclesios.app");
    }
  });
  it("normalises dot segments without leaving the site", () => {
    expect(safeNext("/a/../saved")).toBe("/saved");
  });
});

describe("currentAsNext / withNext", () => {
  it("takes the current page, skipping Home and auth pages", () => {
    expect(currentAsNext({ pathname: "/teachings/eucharist", search: "?x=1", hash: "" })).toBe(
      "/teachings/eucharist?x=1",
    );
    expect(currentAsNext({ pathname: "/" })).toBe("");
    expect(currentAsNext({ pathname: "/login", search: "?next=/x" })).toBe("");
  });
  it("builds sign-in links", () => {
    expect(withNext("/login", "/saved")).toBe("/login?next=%2Fsaved");
    expect(withNext("/register", "/hymnal?q=NCH 56")).toBe(
      "/register?next=%2Fhymnal%3Fq%3DNCH%252056",
    );
    expect(withNext("/login", "")).toBe("/login");
    expect(withNext("/login", "//evil.example")).toBe("/login");
  });
});
