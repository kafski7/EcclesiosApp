import { Body, Controller, HttpCode, Post, Req } from "@nestjs/common";
import {
  ClaimRequestSchema,
  LoginRequestSchema,
  RefreshRequestSchema,
  SetPasswordRequestSchema,
  VerifyOtpRequestSchema,
  type LoginChallengeResponse,
  type LoginRequest,
  type RefreshRequest,
  type SetPasswordRequest,
  type TokenPair,
  type VerifyOtpRequest,
  type VerifyOtpResponse,
} from "@ecclesios/shared";
import type { Request } from "express";
import type { z } from "zod";
import { Public } from "../common/public.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { AuthService } from "./auth.service";

const meta = (req: Request) => ({ ip: req.ip ?? req.socket.remoteAddress ?? "unknown" });

/** functionality §2 — all routes under /api/auth, all rate-limited (functionality §6). */
@Public()
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** §2.1 Super-Admin / platform accounts (users table). */
  @Post("admin-login")
  @HttpCode(200)
  adminLogin(
    @Body(new ZodPipe(LoginRequestSchema)) b: LoginRequest,
    @Req() req: Request,
  ): Promise<LoginChallengeResponse> {
    return this.auth.login("user", b.identifier, b.password, meta(req));
  }

  /** §2.2 Church end-users (members table). */
  @Post("login")
  @HttpCode(200)
  login(
    @Body(new ZodPipe(LoginRequestSchema)) b: LoginRequest,
    @Req() req: Request,
  ): Promise<LoginChallengeResponse> {
    return this.auth.login("member", b.identifier, b.password, meta(req));
  }

  @Post("verify-otp")
  @HttpCode(200)
  verifyOtp(
    @Body(new ZodPipe(VerifyOtpRequestSchema)) b: VerifyOtpRequest,
    @Req() req: Request,
  ): Promise<VerifyOtpResponse> {
    return this.auth.verifyOtp(b.challengeToken, b.otp, meta(req));
  }

  /** Claim a register entry your church created (D-039): code → set-password. Members only. */
  @Post("claim")
  @HttpCode(200)
  claim(
    @Body(new ZodPipe(ClaimRequestSchema)) b: z.output<typeof ClaimRequestSchema>,
    @Req() req: Request,
  ): Promise<LoginChallengeResponse> {
    return this.auth.startClaim(b.identifier, meta(req));
  }

  @Post("set-password")
  @HttpCode(200)
  setPassword(
    @Body(new ZodPipe(SetPasswordRequestSchema)) b: SetPasswordRequest,
    @Req() req: Request,
  ): Promise<TokenPair> {
    return this.auth.setPassword(b.tempToken, b.newPassword, meta(req));
  }

  @Post("refresh")
  @HttpCode(200)
  refresh(
    @Body(new ZodPipe(RefreshRequestSchema)) b: RefreshRequest,
    @Req() req: Request,
  ): Promise<TokenPair> {
    return this.auth.refresh(b.refreshToken, meta(req));
  }

  @Post("logout")
  @HttpCode(204)
  async logout(
    @Body(new ZodPipe(RefreshRequestSchema)) b: RefreshRequest,
    @Req() req: Request,
  ): Promise<void> {
    await this.auth.logout(b.refreshToken, meta(req));
  }
}
