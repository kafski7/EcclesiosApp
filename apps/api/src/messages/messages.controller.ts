import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req } from "@nestjs/common";
import {
  ComposeMessageSchema,
  MessagesQuerySchema,
  RecipientsQuerySchema,
  type Principal,
} from "@ecclesios/shared";
import type { Request } from "express";
import type { z } from "zod";
import { DomainError } from "../auth/core/errors";
import { CurrentPrincipal } from "../common/principal.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { Scope } from "../rbac/scope";
import { RequiresSubscription } from "../subscriptions/requires-subscription";
import { MessagesService } from "./messages.service";

const uuid = new ParseUUIDPipe({
  exceptionFactory: () => new DomainError(400, "VALIDATION_FAILED", "Invalid id."),
});
const ip = (req: Request) => req.ip ?? "unknown";

/**
 * Messages & broadcasts (functionality §4.7, blueprint §3.3, D-051). Own church only (`write`:
 * its Administrators and Managers); broadcasts reach churches below, checked per target.
 * Gated parishes/outstations need an open subscription; deaneries and above are not gated.
 */
@Controller("cms/groups/:groupId/messages")
@Scope({ need: "write" })
@RequiresSubscription()
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get("options")
  options(@Param("groupId", uuid) groupId: string) {
    return this.messages.options(groupId);
  }

  @Post("preview")
  @HttpCode(200)
  preview(
    @Param("groupId", uuid) groupId: string,
    @Body(new ZodPipe(ComposeMessageSchema)) b: z.output<typeof ComposeMessageSchema>,
  ) {
    return this.messages.preview(groupId, b);
  }

  @Post()
  @HttpCode(202)
  send(
    @Param("groupId", uuid) groupId: string,
    @Body(new ZodPipe(ComposeMessageSchema)) b: z.output<typeof ComposeMessageSchema>,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    return this.messages.send(p!.id, groupId, b, ip(req));
  }

  @Get()
  list(
    @Param("groupId", uuid) groupId: string,
    @Query(new ZodPipe(MessagesQuerySchema)) q: z.output<typeof MessagesQuerySchema>,
  ) {
    return this.messages.list(groupId, q.page, q.channel);
  }

  @Get(":id")
  detail(@Param("groupId", uuid) groupId: string, @Param("id", uuid) id: string) {
    return this.messages.detail(groupId, id);
  }

  @Get(":id/recipients")
  recipients(
    @Param("groupId", uuid) groupId: string,
    @Param("id", uuid) id: string,
    @Query(new ZodPipe(RecipientsQuerySchema)) q: z.output<typeof RecipientsQuerySchema>,
  ) {
    return this.messages.recipients(groupId, id, q.page, q.status);
  }
}
