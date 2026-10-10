import { describe, expect, it } from "vitest";
import { ApiClientError } from "./api";
import { errorText } from "./states";

describe("errorText (D-043)", () => {
  const fb = "Please try again.";
  it("offline wins", () => expect(errorText(new Error("x"), fb, false)).toMatch(/offline/));
  it("rate limits", () =>
    expect(errorText(new ApiClientError(429, "RATE_LIMITED", "slow"), fb, true)).toMatch(
      /Too many/,
    ));
  it("shows the API's 4xx message", () =>
    expect(
      errorText(new ApiClientError(404, "HYMN_NOT_FOUND", "We couldn't find that hymn."), fb, true),
    ).toBe("We couldn't find that hymn."));
  it("hides 5xx and unknown errors", () => {
    expect(errorText(new ApiClientError(500, "INTERNAL", "stack trace…"), fb, true)).toBe(fb);
    expect(errorText(new TypeError("Failed to fetch"), fb, true)).toBe(fb);
  });
});
