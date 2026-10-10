import { Body, Controller, Get, Param, ParseUUIDPipe, Put, Req } from "@nestjs/common";
import { UpdateChurchSettingsSchema, type Principal } from "@ecclesios/shared";
import type { Request } from "express";
import type { z } from "zod";
import { DomainError } from "../auth/core/errors";
import { CurrentPrincipal } from "../common/principal.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { Scope } from "../rbac/scope";
import { RequiresSubscription } from "../subscriptions/requires-subscription";
import { ChurchService } from "./church.service";

const uuid = new ParseUUIDPipe({
  exceptionFactory: () => new DomainError(400, "VALIDATION_FAILED", "Invalid id."),
});
const me = (p: Principal | undefined) => p!.id;

/** Users & Roles, Settings (functionality §4.8, §4.10, D-039): staff of this church; changes by Administrators. */
@Controller("cms/groups/:groupId")
@Scope({ need: "write" })
@RequiresSubscription()
export class ChurchController {
  constructor(private readonly church: ChurchService) {}

  @Get("staff")
  staff(@Param("groupId", uuid) groupId: string, @CurrentPrincipal() p: Principal | undefined) {
    return this.church.staff(me(p), groupId);
  }

  @Get("settings")
  settings(@Param("groupId", uuid) groupId: string, @CurrentPrincipal() p: Principal | undefined) {
    return this.church.settings(me(p), groupId);
  }

  @Put("settings")
  update(
    @Param("groupId", uuid) groupId: string,
    @Body(new ZodPipe(UpdateChurchSettingsSchema)) b: z.output<typeof UpdateChurchSettingsSchema>,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    return this.church.updateSettings(me(p), groupId, b, req.ip ?? "unknown");
  }
}
