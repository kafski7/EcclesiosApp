import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { Principal } from "@ecclesios/shared";
import type { Request } from "express";

/** Injects the authenticated caller set by JwtAuthGuard. */
export const CurrentPrincipal = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): Principal | undefined =>
    ctx.switchToHttp().getRequest<Request>().principal,
);
