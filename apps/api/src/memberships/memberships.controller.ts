import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
} from "@nestjs/common";
import {
  MembershipDecisionSchema,
  type JoinResponse,
  type MeResponse,
  type MembershipDecision,
  type Principal,
} from "@ecclesios/shared";
import type { Request } from "express";
import { DomainError } from "../auth/core/errors";
import { CurrentPrincipal } from "../common/principal.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { MembershipsService } from "./memberships.service";

const uuid = new ParseUUIDPipe({
  exceptionFactory: () => new DomainError(400, "VALIDATION_FAILED", "Invalid id."),
});
const ip = (req: Request) => req.ip ?? req.socket.remoteAddress ?? "unknown";

/** Member-only endpoints. Platform accounts have no church memberships. */
function personId(p: Principal | undefined): string {
  if (p?.kind !== "member")
    throw new DomainError(403, "NOT_ALLOWED", "Church memberships are for member accounts.");
  return p.id;
}

@Controller()
export class MembershipsController {
  constructor(private readonly svc: MembershipsService) {}

  @Get("me")
  me(@CurrentPrincipal() p: Principal | undefined): Promise<MeResponse> {
    return this.svc.me(personId(p));
  }

  /** Request to join a parish or outstation; also follows it (D-015). */
  @Post("groups/:groupId/join")
  @HttpCode(201)
  async join(
    @Param("groupId", uuid) groupId: string,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ): Promise<JoinResponse> {
    return { membership: await this.svc.join(personId(p), groupId, ip(req)) };
  }

  /** Leave a church, or cancel a pending request. */
  @Delete("groups/:groupId/membership")
  @HttpCode(204)
  async leave(
    @Param("groupId", uuid) groupId: string,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    await this.svc.leave(personId(p), groupId, ip(req));
  }

  @Put("groups/:groupId/follow")
  @HttpCode(204)
  async follow(
    @Param("groupId", uuid) groupId: string,
    @CurrentPrincipal() p: Principal | undefined,
  ) {
    await this.svc.follow(personId(p), groupId);
  }

  @Delete("groups/:groupId/follow")
  @HttpCode(204)
  async unfollow(
    @Param("groupId", uuid) groupId: string,
    @CurrentPrincipal() p: Principal | undefined,
  ) {
    await this.svc.unfollow(personId(p), groupId);
  }

  /** Pending requests for a church — its Administrators, or its parish's for an outstation (D-016). */
  @Get("groups/:groupId/membership-requests")
  async requests(
    @Param("groupId", uuid) groupId: string,
    @CurrentPrincipal() p: Principal | undefined,
  ) {
    return { items: await this.svc.pendingFor(personId(p), groupId) };
  }

  @Post("membership-requests/:id/decision")
  @HttpCode(200)
  decide(
    @Param("id", uuid) id: string,
    @Body(new ZodPipe(MembershipDecisionSchema)) body: MembershipDecision,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    return this.svc.decide(personId(p), id, body, ip(req));
  }
}
