import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
} from "@nestjs/common";
import {
  CreateGroupSchema,
  GroupStatusSchema,
  UpdateGroupSchema,
  type Principal,
} from "@ecclesios/shared";
import type { Request } from "express";
import type { z } from "zod";
import { DomainError } from "../auth/core/errors";
import { CurrentPrincipal } from "../common/principal.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { Scope } from "../rbac/scope";
import { RequiresSubscription } from "../subscriptions/requires-subscription";
import { GroupsService } from "./groups.service";

const uuid = new ParseUUIDPipe({
  exceptionFactory: () => new DomainError(400, "VALIDATION_FAILED", "Invalid id."),
});
const me = (p: Principal | undefined) => p!.id;
const ip = (req: Request) => req.ip ?? "unknown";

/** Groups under a church (functionality §4.13, D-041). Reading needs aggregates; changes need its Administrators. */
@Controller("cms/groups/:groupId/children")
@RequiresSubscription()
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  @Get()
  @Scope({ need: "readAggregates" })
  list(@Param("groupId", uuid) groupId: string, @CurrentPrincipal() p: Principal | undefined) {
    return this.groups.children(me(p), groupId);
  }

  @Post()
  @HttpCode(201)
  @Scope({ need: "write" })
  create(
    @Param("groupId", uuid) groupId: string,
    @Body(new ZodPipe(CreateGroupSchema)) b: z.output<typeof CreateGroupSchema>,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    return this.groups.create(me(p), groupId, b, ip(req));
  }

  @Put(":childId")
  @Scope({ need: "write" })
  update(
    @Param("groupId", uuid) groupId: string,
    @Param("childId", uuid) childId: string,
    @Body(new ZodPipe(UpdateGroupSchema)) b: z.output<typeof UpdateGroupSchema>,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    return this.groups.update(me(p), groupId, childId, b, ip(req));
  }

  @Post(":childId/status")
  @HttpCode(200)
  @Scope({ need: "write" })
  status(
    @Param("groupId", uuid) groupId: string,
    @Param("childId", uuid) childId: string,
    @Body(new ZodPipe(GroupStatusSchema)) b: z.output<typeof GroupStatusSchema>,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    return this.groups.setActive(me(p), groupId, childId, b.isActive, ip(req));
  }
}
