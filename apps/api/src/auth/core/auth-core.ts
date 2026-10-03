import type {
  AccountKind,
  LoginChallengeResponse,
  Principal,
  TokenPair,
  VerifyOtpResponse,
} from "@ecclesios/shared";
import { PLATFORM_ROLES } from "@ecclesios/shared/domain";
import { generateOtp, hmac, maskDestination, randomToken, safeEqual } from "./crypto";
import { authError } from "./errors";
import { JwtError, signJwt, verifyJwt } from "./jwt";
import { formatOpaque, parseOpaque } from "./opaque-token";
import type { RateLimiter } from "./rate-limit";
import type {
  AccountRecord,
  AccountStore,
  AuditSink,
  AuthConfig,
  AuthState,
  OtpSender,
  PasswordHasher,
} from "./types";

export interface AuthCoreDeps {
  stores: Record<AccountKind, AccountStore>;
  hasher: PasswordHasher;
  otpSender: OtpSender;
  audit: AuditSink;
  rateLimiter: RateLimiter;
  config: AuthConfig;
  clock?: () => Date;
}

export interface RequestMeta {
  ip: string;
}

interface ChallengeClaims {
  typ: "otp";
  sub: string;
  knd: AccountKind;
}

interface AccessClaims {
  typ: "access";
  sub: string;
  knd: AccountKind;
  /** Platform role (users only). Members carry no church claims (D-015). */
  role?: string;
}

const CHALLENGE_AUDIENCE_SUFFIX = ":otp";

/**
 * The whole sign-in flow of functionality §2, independent of NestJS and the database:
 *   login → (password ok) → OTP challenge → verify-otp → tokens  |  tempToken → set-password → tokens
 *   refresh (rotating) · logout (revoke)
 */
export class AuthCore {
  private readonly now: () => Date;
  private dummyHash: Promise<string> | null = null;

  constructor(private readonly d: AuthCoreDeps) {
    this.now = d.clock ?? (() => new Date());
  }

  // ------------------------------------------------------------------ login (step 1)
  async login(kind: AccountKind, identifier: string, password: string, meta: RequestMeta) {
    const id = identifier.trim().toLowerCase();
    await this.d.rateLimiter.consume([
      {
        key: `ip:${meta.ip}`,
        limit: this.d.config.rate.ipLimit,
        windowMs: this.d.config.rate.windowMs,
      },
      {
        key: `id:${kind}:${id}`,
        limit: this.d.config.rate.identifierLimit,
        windowMs: this.d.config.rate.windowMs,
      },
    ]);

    const store = this.d.stores[kind];
    const account = await store.findByIdentifier(identifier.trim());

    if (!account || !account.passwordHash) {
      await this.d.hasher.verify(await this.getDummyHash(), password); // equalise timing
      await this.audit(kind, null, "auth.login.failed", meta, { reason: "unknown_or_no_password" });
      throw authError.invalidCredentials();
    }

    const now = this.now();
    if (account.lockedUntil && account.lockedUntil > now) {
      throw authError.locked(Math.ceil((account.lockedUntil.getTime() - now.getTime()) / 1000));
    }

    const ok = await this.d.hasher.verify(account.passwordHash, password);
    if (!ok) {
      const failed = account.failedLoginCount + 1;
      const lock = failed >= this.d.config.maxFailedLogins;
      await store.update(account.id, {
        failedLoginCount: lock ? 0 : failed,
        lockedUntil: lock ? new Date(now.getTime() + this.d.config.lockSec * 1000) : null,
      });
      await this.audit(kind, account.id, lock ? "auth.account.locked" : "auth.login.failed", meta, {
        reason: "bad_password",
      });
      if (lock) throw authError.locked(this.d.config.lockSec);
      throw authError.invalidCredentials();
    }

    // Disabled accounts are only revealed after a correct password (no enumeration).
    if (!account.active) {
      await this.audit(kind, account.id, "auth.login.failed", meta, { reason: "disabled" });
      throw authError.disabled();
    }

    const code = generateOtp();
    const expiresAt = new Date(now.getTime() + this.d.config.otpTtlSec * 1000);
    await store.update(account.id, {
      failedLoginCount: 0,
      lockedUntil: null,
      otpHash: this.otpHash(kind, account.id, code),
      otpExpiresAt: expiresAt,
      otpAttempts: 0,
    });

    const destination = account.email ?? account.telephone ?? "";
    await this.d.otpSender.send({ kind, accountId: account.id, destination, code, expiresAt });
    await this.audit(kind, account.id, "auth.otp.sent", meta, {
      channel: this.d.otpSender.channel,
    });

    const challengeToken = signJwt(
      { typ: "otp", sub: account.id, knd: kind } satisfies ChallengeClaims,
      this.d.config.accessSecret,
      this.d.config.otpTtlSec,
      this.challengeOpts(),
      now,
    );
    return {
      challengeToken,
      expiresInSeconds: this.d.config.otpTtlSec,
      delivery: { channel: this.d.otpSender.channel, destination: maskDestination(destination) },
    } satisfies LoginChallengeResponse;
  }

  // ------------------------------------------------------------------ verify OTP (step 2)
  async verifyOtp(
    challengeToken: string,
    otp: string,
    meta: RequestMeta,
  ): Promise<VerifyOtpResponse> {
    await this.d.rateLimiter.consume([
      {
        key: `ip:${meta.ip}`,
        limit: this.d.config.rate.ipLimit,
        windowMs: this.d.config.rate.windowMs,
      },
    ]);

    let claims: ChallengeClaims;
    try {
      claims = verifyJwt<ChallengeClaims>(
        challengeToken,
        this.d.config.accessSecret,
        this.challengeOpts(),
        this.now(),
      );
    } catch (e) {
      if (e instanceof JwtError) throw authError.invalidChallenge();
      throw e;
    }
    if (claims.typ !== "otp") throw authError.invalidChallenge();

    const kind = claims.knd;
    const store = this.d.stores[kind];
    const account = await store.findById(claims.sub);
    if (!account || !account.otpHash || !account.otpExpiresAt) throw authError.invalidChallenge();

    const now = this.now();
    if (account.otpExpiresAt <= now) {
      await store.update(account.id, clearOtp());
      throw authError.otpExpired();
    }
    if (account.otpAttempts >= this.d.config.maxOtpAttempts) {
      await store.update(account.id, clearOtp());
      throw authError.otpAttemptsExceeded();
    }

    if (!safeEqual(account.otpHash, this.otpHash(kind, account.id, otp))) {
      const attempts = account.otpAttempts + 1;
      const exhausted = attempts >= this.d.config.maxOtpAttempts;
      await store.update(account.id, exhausted ? clearOtp() : { otpAttempts: attempts });
      await this.audit(kind, account.id, "auth.otp.failed", meta, { attempts });
      if (exhausted) throw authError.otpAttemptsExceeded();
      throw authError.invalidOtp(this.d.config.maxOtpAttempts - attempts);
    }

    // Correct code: single use.
    await store.update(account.id, { ...clearOtp(), lastLoginAt: now });

    if (!account.firstLogin) {
      const secret = randomToken();
      await store.update(account.id, {
        tempTokenHash: this.tokenHash("tmp", kind, account.id, secret),
        tempTokenExpiresAt: new Date(now.getTime() + this.d.config.tempTtlSec * 1000),
      });
      await this.audit(kind, account.id, "auth.password_setup.required", meta);
      return {
        status: "PASSWORD_SETUP_REQUIRED",
        tempToken: formatOpaque("tmp1", kind, account.id, secret),
        expiresInSeconds: this.d.config.tempTtlSec,
      };
    }

    const pair = await this.issueTokens(account, now);
    await this.audit(kind, account.id, "auth.login.succeeded", meta);
    return { status: "AUTHENTICATED", ...pair };
  }

  // ------------------------------------------------------------------ set password (first login)
  async setPassword(tempToken: string, newPassword: string, meta: RequestMeta): Promise<TokenPair> {
    await this.d.rateLimiter.consume([
      {
        key: `ip:${meta.ip}`,
        limit: this.d.config.rate.ipLimit,
        windowMs: this.d.config.rate.windowMs,
      },
    ]);
    const parsed = parseOpaque(tempToken, "tmp1");
    if (!parsed) throw authError.invalidTempToken();
    const store = this.d.stores[parsed.kind];
    const account = await store.findById(parsed.id);
    const now = this.now();
    if (
      !account ||
      !account.tempTokenHash ||
      !account.tempTokenExpiresAt ||
      account.tempTokenExpiresAt <= now ||
      !safeEqual(
        account.tempTokenHash,
        this.tokenHash("tmp", parsed.kind, account.id, parsed.secret),
      )
    ) {
      throw authError.invalidTempToken();
    }

    await store.update(account.id, {
      passwordHash: await this.d.hasher.hash(newPassword),
      firstLogin: now,
      tempTokenHash: null,
      tempTokenExpiresAt: null,
    });
    await this.audit(parsed.kind, account.id, "auth.password.set", meta);
    return this.issueTokens(account, now);
  }

  // ------------------------------------------------------------------ refresh (rotating) & logout
  async refresh(refreshToken: string, meta: RequestMeta): Promise<TokenPair> {
    await this.d.rateLimiter.consume([
      {
        key: `ip:${meta.ip}`,
        limit: this.d.config.rate.ipLimit,
        windowMs: this.d.config.rate.windowMs,
      },
    ]);
    const parsed = parseOpaque(refreshToken, "rft1");
    if (!parsed) throw authError.invalidRefreshToken();
    const store = this.d.stores[parsed.kind];
    const account = await store.findById(parsed.id);
    const now = this.now();
    if (!account || !account.refreshTokenHash || !account.refreshTokenExpiresAt) {
      throw authError.invalidRefreshToken();
    }
    const matches = safeEqual(
      account.refreshTokenHash,
      this.tokenHash("rft", parsed.kind, account.id, parsed.secret),
    );
    if (!matches) {
      // A valid-looking but stale token = possible theft after rotation: revoke the live session.
      await store.update(account.id, { refreshTokenHash: null, refreshTokenExpiresAt: null });
      await this.audit(parsed.kind, account.id, "auth.refresh.reuse_detected", meta);
      throw authError.invalidRefreshToken();
    }
    if (account.refreshTokenExpiresAt <= now || !account.active) {
      await store.update(account.id, { refreshTokenHash: null, refreshTokenExpiresAt: null });
      throw authError.invalidRefreshToken();
    }
    return this.issueTokens(account, now);
  }

  async logout(refreshToken: string, meta: RequestMeta): Promise<void> {
    const parsed = parseOpaque(refreshToken, "rft1");
    if (!parsed) return; // idempotent
    const store = this.d.stores[parsed.kind];
    const account = await store.findById(parsed.id);
    if (
      account?.refreshTokenHash &&
      safeEqual(
        account.refreshTokenHash,
        this.tokenHash("rft", parsed.kind, account.id, parsed.secret),
      )
    ) {
      await store.update(account.id, { refreshTokenHash: null, refreshTokenExpiresAt: null });
      await this.audit(parsed.kind, account.id, "auth.logout", meta);
    }
  }

  // ------------------------------------------------------------------ access tokens
  /** Verifies a Bearer token and returns the caller. Throws JwtError on anything unexpected. */
  verifyAccessToken(token: string): Principal {
    const c = verifyJwt<AccessClaims>(
      token,
      this.d.config.accessSecret,
      this.accessOpts(),
      this.now(),
    );
    if (c.typ !== "access" || typeof c.sub !== "string") throw new JwtError("claims");
    if (c.knd === "member") return { kind: "member", id: c.sub };
    const role = PLATFORM_ROLES.find((r) => r === c.role);
    if (c.knd !== "user" || !role) throw new JwtError("claims");
    return { kind: "user", id: c.sub, role };
  }

  private async issueTokens(account: AccountRecord, now: Date): Promise<TokenPair> {
    const principal = toPrincipal(account);
    const claims: AccessClaims = { typ: "access", sub: account.id, knd: account.kind };
    if (principal.kind === "user") claims.role = principal.role;
    const accessToken = signJwt(
      { ...claims },
      this.d.config.accessSecret,
      this.d.config.accessTtlSec,
      this.accessOpts(),
      now,
    );
    const secret = randomToken();
    await this.d.stores[account.kind].update(account.id, {
      refreshTokenHash: this.tokenHash("rft", account.kind, account.id, secret),
      refreshTokenExpiresAt: new Date(now.getTime() + this.d.config.refreshTtlSec * 1000),
    });
    return {
      accessToken,
      refreshToken: formatOpaque("rft1", account.kind, account.id, secret),
      tokenType: "Bearer",
      expiresInSeconds: this.d.config.accessTtlSec,
      principal,
    };
  }

  // ------------------------------------------------------------------ helpers
  private otpHash(kind: AccountKind, id: string, code: string) {
    return hmac(this.d.config.tokenSecret, "otp", kind, id, code);
  }
  private tokenHash(purpose: "tmp" | "rft", kind: AccountKind, id: string, secret: string) {
    return hmac(this.d.config.tokenSecret, purpose, kind, id, secret);
  }
  private accessOpts() {
    return { issuer: this.d.config.issuer, audience: this.d.config.audience };
  }
  private challengeOpts() {
    return {
      issuer: this.d.config.issuer,
      audience: this.d.config.audience + CHALLENGE_AUDIENCE_SUFFIX,
    };
  }
  private getDummyHash() {
    this.dummyHash ??= this.d.hasher.hash(randomToken(16));
    return this.dummyHash;
  }
  private async audit(
    kind: AccountKind,
    id: string | null,
    action: string,
    meta: RequestMeta,
    metadata: Record<string, unknown> = {},
  ) {
    await this.d.audit.write({
      actorType: kind === "member" ? "MEMBER" : "USER",
      actorId: id,
      action,
      metadata,
      ip: meta.ip,
    });
  }
}

const clearOtp = (): Partial<AuthState> => ({ otpHash: null, otpExpiresAt: null, otpAttempts: 0 });

export function toPrincipal(a: AccountRecord): Principal {
  return a.claims.kind === "member"
    ? { kind: "member", id: a.id }
    : { kind: "user", id: a.id, role: a.claims.role };
}
