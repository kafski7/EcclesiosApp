/**
 * Framework-free error carrying an HTTP status and a stable code.
 * The global exception filter turns it into the ApiError envelope (packages/shared).
 */
export class DomainError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
    readonly retryAfterSec?: number,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export const authError = {
  invalidCredentials: () =>
    new DomainError(401, "INVALID_CREDENTIALS", "The details you entered are incorrect."),
  locked: (retryAfterSec: number) =>
    new DomainError(423, "ACCOUNT_LOCKED", "Too many failed attempts. Try again later.", undefined, retryAfterSec),
  disabled: () => new DomainError(403, "ACCOUNT_DISABLED", "This account is not active."),
  invalidChallenge: () =>
    new DomainError(401, "INVALID_CHALLENGE", "This sign-in attempt has expired. Please sign in again."),
  otpExpired: () => new DomainError(401, "OTP_EXPIRED", "The code has expired. Please sign in again."),
  invalidOtp: (attemptsLeft: number) =>
    new DomainError(401, "INVALID_OTP", "The code is incorrect.", { attemptsLeft }),
  otpAttemptsExceeded: () =>
    new DomainError(429, "OTP_ATTEMPTS_EXCEEDED", "Too many incorrect codes. Please sign in again."),
  invalidTempToken: () =>
    new DomainError(401, "INVALID_TEMP_TOKEN", "This password setup link has expired. Please sign in again."),
  invalidRefreshToken: () =>
    new DomainError(401, "INVALID_REFRESH_TOKEN", "Your session has ended. Please sign in again."),
  rateLimited: (retryAfterSec: number) =>
    new DomainError(429, "RATE_LIMITED", "Too many requests. Please wait and try again.", undefined, retryAfterSec),
};
