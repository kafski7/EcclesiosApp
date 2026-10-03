import { type CanActivate, type ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { IS_PUBLIC } from "../common/public.decorator";
import { DomainError } from "./core/errors";
import { AuthService } from "./auth.service";

/** Global guard: every route needs a valid Bearer access token unless marked @Public(). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]))
      return true;
    const req = ctx.switchToHttp().getRequest<Request>();
    const header = req.headers.authorization ?? "";
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token)
      throw new DomainError(401, "UNAUTHENTICATED", "Sign in to continue.");
    try {
      req.principal = this.auth.verifyAccessToken(token);
      return true;
    } catch {
      throw new DomainError(
        401,
        "UNAUTHENTICATED",
        "Your session has expired. Please sign in again.",
      );
    }
  }
}
