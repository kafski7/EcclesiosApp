import { Inject, Injectable } from "@nestjs/common";
import { ENV, type Env } from "../config/env";
import { AuditService } from "../audit/audit.service";
import { MemberAccountStore, UserAccountStore } from "./account-stores";
import { ArgonHasher } from "./argon-hasher";
import { AuthCore } from "./core/auth-core";
import { MemoryRateLimitStore, RateLimiter } from "./core/rate-limit";
import { DEFAULT_AUTH_LIMITS, type OtpSender } from "./core/types";
import { OTP_SENDER } from "./otp-sender";

export const RATE_LIMIT_STORE = Symbol("RATE_LIMIT_STORE");
export const ISSUER = "ecclesios-api";
export const AUDIENCE = "ecclesios";

/** Nest-facing wrapper: wires AuthCore (pure, unit-tested) to Postgres, argon2, audit and the OTP sender. */
@Injectable()
export class AuthService extends AuthCore {
  constructor(
    @Inject(ENV) env: Env,
    members: MemberAccountStore,
    users: UserAccountStore,
    hasher: ArgonHasher,
    audit: AuditService,
    @Inject(OTP_SENDER) otpSender: OtpSender,
    @Inject(RATE_LIMIT_STORE) rateStore: MemoryRateLimitStore,
  ) {
    super({
      stores: { member: members, user: users },
      hasher,
      otpSender,
      audit,
      rateLimiter: new RateLimiter(rateStore),
      config: {
        ...DEFAULT_AUTH_LIMITS,
        issuer: ISSUER,
        audience: AUDIENCE,
        accessSecret: env.JWT_ACCESS_SECRET,
        tokenSecret: env.JWT_REFRESH_SECRET,
        accessTtlSec: env.JWT_ACCESS_TTL,
        refreshTtlSec: env.JWT_REFRESH_TTL,
        otpTtlSec: env.OTP_TTL_MINUTES * 60,
        rate: {
          ...DEFAULT_AUTH_LIMITS.rate,
          ipLimit: env.AUTH_RATE_IP_MAX,
          identifierLimit: env.AUTH_RATE_IDENTIFIER_MAX,
        },
      },
    });
  }
}
