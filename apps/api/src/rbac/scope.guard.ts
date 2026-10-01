import { type CanActivate, type ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { AuditService } from "../audit/audit.service";
import { DomainError } from "../auth/core/errors";
import { CAPABILITY, SCOPE_KEY, type ScopeOptions } from "./scope";
import { ScopeService } from "./scope.service";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Data isolation (functionality §6): runs after JwtAuthGuard on routes marked @Scope.
 * Denials return 403 SCOPE_DENIED (same answer for "exists but not yours" and "doesn't exist")
 * and are written to the audit log.
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

    const req = ctx.switchToHttp().getRequest<Request>();
    const p = req.principal;
    const target = String(req.params[opts.param] ?? "");
    if (!UUID.test(target)) throw new DomainError(400, "VALIDATION_FAILED", `Invalid ${opts.param}.`);
    if (!p) throw new DomainError(401, "UNAUTHENTICATED", "Sign in to continue.");

    // Platform accounts have no church scope (blueprint §3.3 "Super-Admin: —").
    if (p.kind !== "member") {
      await this.deny(req, null, target, opts, "NONE", "platform_account");
      throw new DomainError(403, "SCOPE_DENIED", "Platform accounts cannot access church data.");
    }

    const access = await this.scopes.resolve(p.groupId, target);
    (req as Request & { access?: string }).access = access;
    if (CAPABILITY[opts.need](access)) return true;

    await this.deny(req, p.groupId, target, opts, access, "insufficient_scope");
    throw new DomainError(403, "SCOPE_DENIED", "You don't have access to this group's data.");
  }

  private async deny(req: Request, viewerGroup: string | null, target: string, opts: Required<ScopeOptions>, access: string, reason: string) {
    const p = req.principal;
    await this.audit.write({
      actorType: p?.kind === "member" ? "MEMBER" : "USER",
      actorId: p?.id ?? null,
      groupId: viewerGroup,
      action: "access.denied",
      entityType: "group",
      entityId: target,
      metadata: { need: opts.need, access, reason, route: `${req.method} ${req.route?.path ?? req.path}` },
      ip: req.ip ?? null,
    });
  }
}
