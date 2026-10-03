import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Req } from "@nestjs/common";
import {
  StartTrialRequestSchema,
  type Principal,
  type PlansResponseSchema,
  type StartTrialRequest,
  type SubscriptionSummary,
} from "@ecclesios/shared";
import type { Request } from "express";
import type { z } from "zod";
import { DomainError } from "../auth/core/errors";
import { CurrentPrincipal } from "../common/principal.decorator";
import { Public } from "../common/public.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { Scope } from "../rbac/scope";
import { SubscriptionsService } from "./subscriptions.service";

const uuid = new ParseUUIDPipe({
  exceptionFactory: () => new DomainError(400, "VALIDATION_FAILED", "Invalid id."),
});

@Controller()
export class SubscriptionsController {
  constructor(private readonly subs: SubscriptionsService) {}

  /** GET /api/public/plans — Subscribe page (functionality §3.9) and CMS billing. */
  @Public()
  @Get("public/plans")
  async plans(): Promise<z.infer<typeof PlansResponseSchema>> {
    return { items: await this.subs.plans() };
  }

  /** POST /api/groups/:groupId/subscription/trial — the parish Administrator starts the one-time free trial. */
  @Post("groups/:groupId/subscription/trial")
  @Scope({ need: "write" })
  @HttpCode(201)
  async trial(
    @Param("groupId", uuid) groupId: string,
    @Body(new ZodPipe(StartTrialRequestSchema)) body: StartTrialRequest,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ): Promise<SubscriptionSummary | null> {
    return this.subs.startTrial(p!.id, groupId, body.planCode, req.ip ?? "unknown");
  }
}
