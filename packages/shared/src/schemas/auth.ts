import { z } from "zod";
import { ACCESS_LEVELS } from "../domain/access";
import { HierarchyLevelSchema, MemberRoleSchema, PlatformRoleSchema } from "../enums";

/** functionality §2 — login identifier is an email or an E.164 telephone. */
export const IdentifierSchema = z
  .string()
  .trim()
  .min(3)
  .max(254)
  .refine((v) => v.includes("@") || /^\+[1-9]\d{7,14}$/.test(v), {
    message: "Enter an email address or a telephone number like +233241234567",
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

/** What the access token says about the caller (todo Phase 2: id, role, group_id, hierarchy_level). */
export const PrincipalSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("member"),
    id: z.string().uuid(),
    role: MemberRoleSchema,
    groupId: z.string().uuid(),
    hierarchyLevel: HierarchyLevelSchema,
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
export const GroupAccessResponseSchema = z.object({
  groupId: z.string().uuid(),
  access: z.enum(ACCESS_LEVELS),
  can: z.object({
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
  "INVALID_CHALLENGE",
  "OTP_EXPIRED",
  "INVALID_OTP",
  "OTP_ATTEMPTS_EXCEEDED",
  "INVALID_TEMP_TOKEN",
  "INVALID_REFRESH_TOKEN",
  "RATE_LIMITED",
] as const;
export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];
