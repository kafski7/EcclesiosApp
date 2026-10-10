import { describe, expect, it } from "vitest";
import { isCmsLink } from "./account";

describe("notification links (D-039)", () => {
  it("knows which links belong to Church Management", () => {
    expect(isCmsLink("/admin/members/requests")).toBe(true);
    expect(isCmsLink("/explore/posts/1")).toBe(false);
    expect(isCmsLink(null)).toBe(false);
  });
});
