import { z } from "zod";
import { E164, normalisePhone } from "../domain/phone.js";
import { MEMBER_ACCESS_ORDER } from "../domain/memberships.js";
import { PlatformRoleSchema } from "../enums.js";

/** functionality §2 — login identifier is an email or an E.164 telephone. */
export const IdentifierSchema = z
  .string()
  .trim()
  .min(3)
  .max(254)
  // Phones are tidied to E.164 (D-040), so "024 123 4567" signs in as +233241234567.
  .transform((v) => (v.includes("@") ? v : normalisePhone(v)))
  .refine((v) => v.includes("@") || E164.test(v), {
    message: "Enter an email address or a phone number like 024 123 4567",
  });

/** Password policy: 10–128 chars, at least one letter and one digit. */
export const PasswordSchema = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(128)
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/\d/, "Include at least one number");

export const LoginRequestSchema = z.object({
  identifier: IdentifierSchema,
  password: z.string().min(1).max(128),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

/** Same shape whatever happens — never reveals whether the account exists. */
export const LoginChallengeResponseSchema = z.object({
  challengeToken: z.string(),
  expiresInSeconds: z.number().int(),
  delivery: z.object({
    channel: z.enum(["console", "sms", "email"]),
    destination: z.string(),
  }),
});
export type LoginChallengeResponse = z.infer<typeof LoginChallengeResponseSchema>;

export const VerifyOtpRequestSchema = z.object({
  challengeToken: z.string().min(10).max(2048),
  otp: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
});
export type VerifyOtpRequest = z.infer<typeof VerifyOtpRequestSchema>;

export const AccountKindSchema = z.enum(["member", "user"]);
export type AccountKind = z.infer<typeof AccountKindSchema>;

/**
 * What the access token says about the caller. A member token names the PERSON only:
 * churches and roles come from their memberships, checked per request (D-015).
 */
export const PrincipalSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("member"),
    id: z.string().uuid(),
  }),
  z.object({
    kind: z.literal("user"),
    id: z.string().uuid(),
    role: PlatformRoleSchema,
  }),
]);
export type Principal = z.infer<typeof PrincipalSchema>;

export const TokenPairSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  tokenType: z.literal("Bearer"),
  expiresInSeconds: z.number().int(),
  principal: PrincipalSchema,
});
export type TokenPair = z.infer<typeof TokenPairSchema>;

export const VerifyOtpResponseSchema = z.discriminatedUnion("status", [
  TokenPairSchema.extend({ status: z.literal("AUTHENTICATED") }),
  z.object({
    status: z.literal("PASSWORD_SETUP_REQUIRED"),
    tempToken: z.string(),
    expiresInSeconds: z.number().int(),
  }),
]);
export type VerifyOtpResponse = z.infer<typeof VerifyOtpResponseSchema>;

export const SetPasswordRequestSchema = z.object({
  tempToken: z.string().min(10).max(512),
  newPassword: PasswordSchema,
});
export type SetPasswordRequest = z.infer<typeof SetPasswordRequestSchema>;

export const RefreshRequestSchema = z.object({ refreshToken: z.string().min(10).max(512) });
export type RefreshRequest = z.infer<typeof RefreshRequestSchema>;

/** GET /api/groups/:groupId/access — what the caller may do in a group (drives the CMS context switcher). */
export const MemberAccessSchema = z.enum(MEMBER_ACCESS_ORDER);
export const GroupAccessResponseSchema = z.object({
  groupId: z.string().uuid(),
  /** Every access the caller holds on this group via their memberships, strongest first. */
  access: z.array(MemberAccessSchema),
  can: z.object({
    memberContent: z.boolean(),
    write: z.boolean(),
    approve: z.boolean(),
    readRecords: z.boolean(),
    readSummaries: z.boolean(),
    readAggregates: z.boolean(),
  }),
});
export type GroupAccessResponse = z.infer<typeof GroupAccessResponseSchema>;

/** Stable error codes returned by the auth endpoints. Frontends switch on these, not on messages. */
export const AUTH_ERROR_CODES = [
  "INVALID_CREDENTIALS",
  "ACCOUNT_LOCKED",
  "ACCOUNT_DISABLED",
  "ACCOUNT_EXISTS",
  "CHURCH_NOT_FOUND",
  "INVALID_CHALLENGE",
  "OTP_EXPIRED",
  "INVALID_OTP",
  "OTP_ATTEMPTS_EXCEEDED",
  "INVALID_TEMP_TOKEN",
  "INVALID_REFRESH_TOKEN",
  "RATE_LIMITED",
  "NOTHING_TO_CLAIM",
  "CLAIM_ACCOUNT",
  "WRONG_PASSWORD",
] as const;
export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];
