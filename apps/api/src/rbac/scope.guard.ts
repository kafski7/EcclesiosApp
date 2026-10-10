import { type CanActivate, type ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { hasCapability, type Capability, type MemberAccess } from "@ecclesios/shared/domain";
import type { Request } from "express";
import { AuditService } from "../audit/audit.service";
import { DomainError } from "../auth/core/errors";
import { SCOPE_KEY, type ScopeOptions } from "./scope";
import { ScopeService } from "./scope.service";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ScopedRequest = Request & { access?: MemberAccess[] };

/**
 * Data isolation (functionality §6): runs after JwtAuthGuard on routes marked @Scope.
 * Access comes from the caller's ACTIVE memberships only (D-015) — pending requests grant nothing.
 * Denials return 403 SCOPE_DENIED and are written to the audit log.
 */
@Injectable()
export class ScopeGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly scopes: ScopeService,
    private readonly audit: AuditService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const opts = this.reflector.getAllAndOverride<Required<ScopeOptions> | undefined>(SCOPE_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!opts) return true;

    const req = ctx.switchToHttp().getRequest<ScopedRequest>();
    const p = req.principal;
    const target = String(req.params[opts.param] ?? "");
    if (!UUID.test(target))
      throw new DomainError(400, "VALIDATION_FAILED", `Invalid ${opts.param}.`);
    if (!p) throw new DomainError(401, "UNAUTHENTICATED", "Sign in to continue.");

    // Platform accounts have no church scope (blueprint §3.3 "Super-Admin: —").
    if (p.kind !== "member") {
      await this.deny(req, target, opts, [], "platform_account");
      throw new DomainError(403, "SCOPE_DENIED", "Platform accounts cannot access church data.");
    }

    const access = await this.scopes.resolve(p.id, target);
    req.access = access;
    const needs: readonly Capability[] = typeof opts.need === "string" ? [opts.need] : opts.need;
    if (needs.some((n) => hasCapability(access, n))) return true;

    await this.deny(
      req,
      target,
      opts,
      access,
      access.length ? "insufficient_scope" : "no_membership",
    );
    throw new DomainError(403, "SCOPE_DENIED", "You don't have access to this church's data.");
  }

  private async deny(
    req: Request,
    target: string,
    opts: Required<ScopeOptions>,
    access: MemberAccess[],
    reason: string,
  ) {
    const p = req.principal;
    await this.audit.write({
      actorType: p?.kind === "member" ? "MEMBER" : "USER",
      actorId: p?.id ?? null,
      groupId: target,
      action: "access.denied",
      entityType: "group",
      entityId: target,
      metadata: {
        need: opts.need,
        access,
        reason,
        route: `${req.method} ${req.route?.path ?? req.path}`,
      },
      ip: req.ip ?? null,
    });
  }
}
