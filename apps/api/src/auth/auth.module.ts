import { Module } from "@nestjs/common";
import { MemberAccountStore, UserAccountStore } from "./account-stores";
import { ArgonHasher } from "./argon-hasher";
import { AuthController } from "./auth.controller";
import { AuthService, RATE_LIMIT_STORE } from "./auth.service";
import { MemoryRateLimitStore } from "./core/rate-limit";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { ConsoleOtpSender, OTP_SENDER } from "./otp-sender";

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    MemberAccountStore,
    UserAccountStore,
    ArgonHasher,
    JwtAuthGuard,
    { provide: OTP_SENDER, useClass: ConsoleOtpSender },
    // In-memory = one API instance only. Redis store before scaling out (todo Phase 9).
    { provide: RATE_LIMIT_STORE, useFactory: () => new MemoryRateLimitStore() },
  ],
  exports: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
