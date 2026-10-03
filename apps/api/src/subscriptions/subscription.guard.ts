import { type CanActivate, type ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { REQUIRES_SUBSCRIPTION } from "./requires-subscription";
import { SubscriptionsService } from "./subscriptions.service";

/** 402 SUBSCRIPTION_REQUIRED on @RequiresSubscription routes whose church is not subscribed. */
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly subs: SubscriptionsService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const param = this.reflector.getAllAndOverride<string | undefined>(REQUIRES_SUBSCRIPTION, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!param) return true;
    const req = ctx.switchToHttp().getRequest<Request>();
    await this.subs.assertOpen(String(req.params[param] ?? ""));
    return true;
  }
}
