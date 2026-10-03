import type { AccountKind, PlatformRole } from "@ecclesios/shared";

/** Auth-state columns shared by `users` and `members` (packages/db schema/_common.ts). Names match the Drizzle properties. */
export interface AuthState {
  otpHash: string | null;
  otpExpiresAt: Date | null;
  otpAttempts: number;
  tempTokenHash: string | null;
  tempTokenExpiresAt: Date | null;
  refreshTokenHash: string | null;
  refreshTokenExpiresAt: Date | null;
  passwordHash: string | null;
  firstLogin: Date | null;
  lastLoginAt: Date | null;
  failedLoginCount: number;
  lockedUntil: Date | null;
}

export type AccountClaims =
  | { kind: "member" } // churches + roles come from memberships, per request (D-015)
  | { kind: "user"; role: PlatformRole };

export interface AccountRecord extends AuthState {
  id: string;
  kind: AccountKind;
  /** Account standing only. A pending church membership never blocks sign-in (D-015). */
  active: boolean;
  email: string | null;
  telephone: string | null;
  claims: AccountClaims;
}

/** One per auth table (members → /login, users → /admin-login). */
export interface AccountStore {
  findByIdentifier(identifier: string): Promise<AccountRecord | null>;
  findById(id: string): Promise<AccountRecord | null>;
  update(id: string, patch: Partial<AuthState>): Promise<void>;
}

export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(hash: string, plain: string): Promise<boolean>;
}

export interface OtpMessage {
  kind: AccountKind;
  accountId: string;
  destination: string;
  code: string;
  expiresAt: Date;
}

export interface OtpSender {
  readonly channel: "console" | "sms" | "email";
  send(msg: OtpMessage): Promise<void>;
}

export interface AuditEntry {
  actorType: "USER" | "MEMBER" | "SYSTEM";
  actorId?: string | null;
  groupId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ip?: string | null;
}

export interface AuditSink {
  write(entry: AuditEntry): Promise<void>;
}

export interface AuthConfig {
  issuer: string;
  audience: string;
  accessSecret: string;
  /** Pepper for HMAC of OTPs, temp tokens and refresh tokens. */
  tokenSecret: string;
  accessTtlSec: number;
  refreshTtlSec: number;
  otpTtlSec: number;
  tempTtlSec: number;
  maxOtpAttempts: number;
  maxFailedLogins: number;
  lockSec: number;
  rate: { ipLimit: number; identifierLimit: number; windowMs: number };
}

export const DEFAULT_AUTH_LIMITS = {
  otpTtlSec: 600, //            functionality §6: OTPs expire in 10 minutes
  tempTtlSec: 900, //           todo P2: 15-minute tempToken
  maxOtpAttempts: 5,
  maxFailedLogins: 5,
  lockSec: 15 * 60,
  rate: { ipLimit: 30, identifierLimit: 5, windowMs: 15 * 60_000 },
} as const;
