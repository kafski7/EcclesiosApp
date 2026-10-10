import { describe, expect, it } from "vitest";
import {
  commentSegments,
  compactCount,
  containsLink,
  encodeMentions,
  engageHref,
  engageKey,
  mentionIds,
  mentionQueryAt,
  parseEngageKey,
} from "./engagement.js";

const A = "0a1b2c3d-0000-4000-8000-000000000001";
const B = "0a1b2c3d-0000-4000-8000-000000000002";

describe("keys and paths (D-035)", () => {
  it("round-trips and rejects junk", () => {
    expect(parseEngageKey(engageKey("TEACHING", A))).toEqual({ kind: "TEACHING", id: A });
    expect(parseEngageKey("NEWS:" + A)).toBe(null);
    expect(parseEngageKey("POST:nope")).toBe(null);
  });
  it("paths", () => {
    expect(engageHref("HYMN", { id: A, slug: "silent-night" })).toBe("/hymnal/silent-night");
    expect(engageHref("EPISODE", { id: A, podcastSlug: "weekly" })).toBe("/podcasts/weekly");
  });
  it("compact counts", () => {
    expect([999, 1200, 1000, 15400, 2_300_000].map(compactCount)).toEqual([
      "999",
      "1.2k",
      "1k",
      "15k",
      "2.3M",
    ]);
  });
});

describe("containsLink", () => {
  it.each([
    "see https://example.com",
    "go to www.something.net",
    "visit example.com now",
    "bit.ly/abc",
    "mail me at a.b@gmail.com",
    "ftp://x.y",
    "parish.church/events",
  ])("blocks: %s", (s) => {
    expect(containsLink(s)).toBe(true);
  });
  it.each([
    "Amen!",
    "Read Jn 3.16 today",
    "Mass at 7 a.m. e.g. Sunday",
    "St. Theresa Parish",
    "Thanks... see you",
    "Ps. 23 is lovely",
  ])("allows: %s", (s) => {
    expect(containsLink(s)).toBe(false);
  });
});

describe("mentions", () => {
  it("encodes picked names, longest first, and leaves the rest", () => {
    const out = encodeMentions("Thanks @Ama Mensah and @Ama, also @Kwame", [
      { id: A, name: "Ama" },
      { id: B, name: "Ama Mensah" },
    ]);
    expect(out).toBe(`Thanks @{${B}} and @{${A}}, also @Kwame`);
  });
  it("finds ids once and renders names", () => {
    const body = `Hi @{${A}} and @{${A}} and @{${B}}`;
    expect(mentionIds(body)).toEqual([A, B]);
    expect(commentSegments(body, new Map([[A, "Kofi Asante"]]))).toEqual([
      { t: "text", v: "Hi " },
      { t: "mention", id: A, name: "Kofi Asante" },
      { t: "text", v: " and " },
      { t: "mention", id: A, name: "Kofi Asante" },
      { t: "text", v: " and " },
      { t: "text", v: "@someone" },
    ]);
  });
  it("detects the mention being typed", () => {
    expect(mentionQueryAt("Hello @Kof", 10)).toEqual({ start: 6, query: "Kof" });
    expect(mentionQueryAt("email@x", 7)).toBe(null);
    expect(mentionQueryAt("@", 1)).toEqual({ start: 0, query: "" });
  });
});
