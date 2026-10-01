/** In-memory doubles for AuthCore unit tests (not shipped in the build). */
import { createHash } from "node:crypto";
import type { AccountKind } from "@ecclesios/shared";
import { AuthCore } from "./auth-core";
import { MemoryRateLimitStore, RateLimiter } from "./rate-limit";
import type {
  AccountRecord,
  AccountStore,
  AuditEntry,
  AuthConfig,
  AuthState,
  OtpMessage,
  PasswordHasher,
} from "./types";
import { DEFAULT_AUTH_LIMITS } from "./types";

export class MemoryStore implements AccountStore {
  readonly rows = new Map<string, AccountRecord>();
  add(r: AccountRecord) {
    this.rows.set(r.id, structuredClone(r));
  }
  async findByIdentifier(identifier: string) {
    const i = identifier.toLowerCase();
    for (const r of this.rows.values())
      if (r.email?.toLowerCase() === i || r.telephone === identifier) return structuredClone(r);
    return null;
  }
  async findById(id: string) {
    const r = this.rows.get(id);
    return r ? structuredClone(r) : null;
  }
  async update(id: string, patch: Partial<AuthState>) {
    const r = this.rows.get(id);
    if (r) Object.assign(r, patch);
  }
}

/** Fast, deterministic stand-in for argon2 (tests only). */
export const fakeHasher: PasswordHasher = {
  async hash(p) {
    return "fake$" + createHash("sha256").update(p).digest("hex");
  },
  async verify(h, p) {
    return h === "fake$" + createHash("sha256").update(p).digest("hex");
  },
};

export const blankAuth = (): AuthState => ({
  otpHash: null,
  otpExpiresAt: null,
  otpAttempts: 0,
  tempTokenHash: null,
  tempTokenExpiresAt: null,
  refreshTokenHash: null,
  refreshTokenExpiresAt: null,
  passwordHash: null,
  firstLogin: null,
  lastLoginAt: null,
  failedLoginCount: 0,
  lockedUntil: null,
});

export const TEST_CONFIG: AuthConfig = {
  issuer: "ecclesios-api",
  audience: "ecclesios",
  accessSecret: "test-access-secret-0123456789abcdef",
  tokenSecret: "test-token-secret-0123456789abcdef",
  accessTtlSec: 900,
  refreshTtlSec: 30 * 86400,
  ...DEFAULT_AUTH_LIMITS,
};

export async function makeHarness(config: Partial<AuthConfig> = {}) {
  let now = new Date("2026-10-01T09:00:00Z");
  const clock = () => new Date(now);
  const advance = (sec: number) => {
    now = new Date(now.getTime() + sec * 1000);
  };
  const stores: Record<AccountKind, MemoryStore> = { member: new MemoryStore(), user: new MemoryStore() };
  const sent: OtpMessage[] = [];
  const audits: AuditEntry[] = [];
  const pw = await fakeHasher.hash("Ecclesios#2026");

  stores.member.add({
    ...blankAuth(),
    id: "00000000-0000-4000-8000-000000000507",
    kind: "member",
    active: true,
    email: "theresa.pastor@dev.ecclesios.local",
    telephone: "+2332000000508",
    passwordHash: pw,
    firstLogin: new Date("2026-01-01"),
    claims: { kind: "member", role: "ADMINISTRATOR", groupId: "00000000-0000-4000-8000-000000000107", hierarchyLevel: "PARISH" },
  });
  stores.member.add({
    ...blankAuth(),
    id: "00000000-0000-4000-8000-000000000517",
    kind: "member",
    active: true,
    email: "kofi.asante@dev.ecclesios.local",
    telephone: "+2332000000518",
    passwordHash: pw,
    firstLogin: null,
    claims: { kind: "member", role: "PARISHIONER", groupId: "00000000-0000-4000-8000-000000000107", hierarchyLevel: "PARISH" },
  });
  stores.member.add({
    ...blankAuth(),
    id: "00000000-0000-4000-8000-000000000599",
    kind: "member",
    active: false,
    email: "inactive@dev.ecclesios.local",
    telephone: null,
    passwordHash: pw,
    firstLogin: new Date("2026-01-01"),
    claims: { kind: "member", role: "PARISHIONER", groupId: "00000000-0000-4000-8000-000000000107", hierarchyLevel: "PARISH" },
  });
  stores.user.add({
    ...blankAuth(),
    id: "00000000-0000-4000-8000-000000000900",
    kind: "user",
    active: true,
    email: "superadmin@dev.ecclesios.local",
    telephone: "+233200000900",
    passwordHash: pw,
    firstLogin: new Date("2026-01-01"),
    claims: { kind: "user", role: "SUPER_ADMIN" },
  });

  const core = new AuthCore({
    stores,
    hasher: fakeHasher,
    otpSender: { channel: "console", send: async (m) => void sent.push(m) },
    audit: { write: async (e) => void audits.push(e) },
    rateLimiter: new RateLimiter(new MemoryRateLimitStore(), () => clock().getTime()),
    config: { ...TEST_CONFIG, ...config },
    clock,
  });
  return { core, stores, sent, audits, advance, clock };
}

/** Runner-agnostic: returns the thrown error (or fails if nothing was thrown). */
export async function caught(fn: () => Promise<unknown>): Promise<{ code?: string; status?: number; details?: unknown; retryAfterSec?: number }> {
  try {
    await fn();
  } catch (e) {
    return e as never;
  }
  throw new Error("expected the call to throw");
}
