import { describe, expect, it } from "vitest";
import { authErrorMessage, fieldErrors, restartsSignIn } from "./auth-errors";

describe("authErrorMessage", () => {
  it("maps known codes", () => {
    expect(authErrorMessage({ code: "CHURCH_NOT_FOUND" })).toMatch(/parish or outstation/);
  });
  it("adds attempts left for a wrong code", () => {
    expect(authErrorMessage({ code: "INVALID_OTP", details: { attemptsLeft: 1 } })).toBe(
      "That code is incorrect. 1 attempt left.",
    );
    expect(authErrorMessage({ code: "INVALID_OTP", details: { attemptsLeft: 3 } })).toMatch(
      /3 attempts left/,
    );
  });
  it("falls back for unknown or missing codes", () => {
    expect(authErrorMessage({ code: "WHATEVER" })).toMatch(/Something went wrong/);
    expect(authErrorMessage(null)).toMatch(/Something went wrong/);
  });
});

describe("restartsSignIn", () => {
  it("sends expired/exhausted challenges back to step 1 only", () => {
    expect(restartsSignIn("OTP_EXPIRED")).toBe(true);
    expect(restartsSignIn("INVALID_OTP")).toBe(false);
  });
});

describe("fieldErrors", () => {
  it("takes the first message per field", () => {
    expect(fieldErrors({ fieldErrors: { email: ["Bad", "Worse"], password: [] } })).toEqual({
      email: "Bad",
    });
    expect(fieldErrors(undefined)).toEqual({});
  });
});
