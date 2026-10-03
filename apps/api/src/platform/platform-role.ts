import { type CanActivate, type ExecutionContext, Injectable, SetMetadata } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { PlatformRole as Role } from "@ecclesios/shared/domain";
import type { Request } from "express";
import { DomainError } from "../auth/core/errors";

export const PLATFORM_ROLE_KEY = "ecclesios:platformRole";

/** Route for platform accounts (users table) with one of these roles — never for church members. */
export const PlatformRole = (...roles: Role[]) => SetMetadata(PLATFORM_ROLE_KEY, roles);

@Injectable()
export class PlatformRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(PLATFORM_ROLE_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!roles) return true;
    const p = ctx.switchToHttp().getRequest<Request>().principal;
    if (p?.kind === "user" && roles.includes(p.role)) return true;
    throw new DomainError(403, "FORBIDDEN", "This area is for Ecclesios platform administrators.");
  }
}
