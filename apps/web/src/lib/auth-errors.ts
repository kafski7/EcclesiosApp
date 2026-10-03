/**
 * Plain-language messages for the stable API error codes (functionality §2.3).
 * The UI switches on `code`, never on the server's message text.
 */
const MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: "That email/phone and password don't match. Check them and try again.",
  ACCOUNT_LOCKED: "Too many attempts. Your account is locked for a few minutes.",
  ACCOUNT_DISABLED: "This account is not active. Contact your parish office.",
  INVALID_CHALLENGE: "This sign-in attempt has expired. Please start again.",
  OTP_EXPIRED: "The code has expired. Please sign in again to get a new one.",
  INVALID_OTP: "That code is incorrect.",
  OTP_ATTEMPTS_EXCEEDED: "Too many incorrect codes. Please sign in again.",
  INVALID_TEMP_TOKEN: "Your password setup time ran out. Please sign in again.",
  RATE_LIMITED: "Too many requests. Please wait a moment and try again.",
  ACCOUNT_EXISTS: "An account with this email or phone already exists. Try signing in instead.",
  CHURCH_NOT_FOUND: "Choose your parish or outstation from the list.",
  ALREADY_MEMBER: "You're already a member of this church.",
  REQUEST_PENDING: "Your request to join is waiting for approval.",
  VALIDATION_FAILED: "Some fields need attention.",
  NETWORK_ERROR: "Can't reach Ecclesios. Check your connection and try again.",
};

const FALLBACK = "Something went wrong. Please try again.";

export interface ErrorLike {
  code?: string;
  details?: unknown;
  retryAfterSec?: number;
}

/** Human message for an API error. Adds attempts left / wait time when the API provides them. */
export function authErrorMessage(err: ErrorLike | null | undefined): string {
  if (!err?.code) return FALLBACK;
  const base = MESSAGES[err.code] ?? FALLBACK;
  if (err.code === "INVALID_OTP") {
    const left = (err.details as { attemptsLeft?: number } | undefined)?.attemptsLeft;
    if (typeof left === "number")
      return `${base} ${left} ${left === 1 ? "attempt" : "attempts"} left.`;
  }
  return base;
}

/** Errors that end the OTP step and send the user back to the password form. */
export const restartsSignIn = (code?: string) =>
  code === "INVALID_CHALLENGE" ||
  code === "OTP_EXPIRED" ||
  code === "OTP_ATTEMPTS_EXCEEDED" ||
  code === "INVALID_TEMP_TOKEN";

/** Field errors from a VALIDATION_FAILED response (Zod `flatten()` shape). */
export function fieldErrors(details: unknown): Record<string, string> {
  const fe = (details as { fieldErrors?: Record<string, string[] | undefined> } | undefined)
    ?.fieldErrors;
  if (!fe) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(fe)) if (v?.[0]) out[k] = v[0];
  return out;
}
