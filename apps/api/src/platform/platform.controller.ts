import { Body, Controller, Get, HttpCode, Post, Req } from "@nestjs/common";
import {
  GrantSubscriptionRequestSchema,
  type GrantSubscriptionRequest,
  type PlatformOverview,
  type Principal,
  type SubscriptionSummary,
} from "@ecclesios/shared";
import type { Request } from "express";
import { CurrentPrincipal } from "../common/principal.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { SubscriptionsService } from "../subscriptions/subscriptions.service";
import { PlatformRole } from "./platform-role";
import { PlatformService } from "./platform.service";

/** Super-Admin console (functionality §2.1, todo Phase 4). */
@Controller("platform")
@PlatformRole("SUPER_ADMIN")
export class PlatformController {
  constructor(
    private readonly platform: PlatformService,
    private readonly subs: SubscriptionsService,
  ) {}

  @Get("overview")
  overview(): Promise<PlatformOverview> {
    return this.platform.overview();
  }

  @Get("subscriptions")
  async subscriptions() {
    return { items: await this.platform.subscriptionList() };
  }

  /** Manual activation / renewal / upgrade with a payment reference (D-021). */
  @Post("subscriptions")
  @HttpCode(201)
  grant(
    @Body(new ZodPipe(GrantSubscriptionRequestSchema)) body: GrantSubscriptionRequest,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ): Promise<SubscriptionSummary | null> {
    return this.subs.grant(p!.id, body, req.ip ?? "unknown");
  }
}
