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
  Query,
  Req,
} from "@nestjs/common";
import {
  CollectionsQuerySchema,
  RecordCollectionSchema,
  ReviewPendingCollectionSchema,
  type Principal,
} from "@ecclesios/shared";
import type { Request } from "express";
import type { z } from "zod";
import { DomainError } from "../auth/core/errors";
import { CurrentPrincipal } from "../common/principal.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { Scope } from "../rbac/scope";
import { RequiresSubscription } from "../subscriptions/requires-subscription";
import { CollectionsService } from "./collections.service";

const uuid = new ParseUUIDPipe({
  exceptionFactory: () => new DomainError(400, "VALIDATION_FAILED", "Invalid id."),
});
const me = (p: Principal | undefined) => p!.id;
const ip = (req: Request) => req.ip ?? "unknown";

/**
 * Collections (blueprint §8.1, D-041). The church in the URL is the outstation when recording and the
 * parish when reviewing; both are that church's own staff (`write`).
 */
@Controller("cms/groups/:groupId")
@Scope({ need: "write" })
@RequiresSubscription()
export class CollectionsController {
  constructor(private readonly collections: CollectionsService) {}

  @Get("collections")
  list(
    @Param("groupId", uuid) groupId: string,
    @Query(new ZodPipe(CollectionsQuerySchema)) q: z.output<typeof CollectionsQuerySchema>,
    @CurrentPrincipal() p: Principal | undefined,
  ) {
    return this.collections.list(me(p), groupId, q);
  }

  @Post("collections")
  @HttpCode(201)
  async record(
    @Param("groupId", uuid) groupId: string,
    @Body(new ZodPipe(RecordCollectionSchema)) b: z.output<typeof RecordCollectionSchema>,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    const row = await this.collections.record(me(p), groupId, b, ip(req));
    return { id: row.id, status: row.status };
  }

  @Put("collections/:id")
  @HttpCode(204)
  async update(
    @Param("groupId", uuid) groupId: string,
    @Param("id", uuid) id: string,
    @Body(new ZodPipe(RecordCollectionSchema)) b: z.output<typeof RecordCollectionSchema>,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    await this.collections.update(me(p), groupId, id, b, ip(req));
  }

  @Delete("collections/:id")
  @HttpCode(204)
  async remove(
    @Param("groupId", uuid) groupId: string,
    @Param("id", uuid) id: string,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    await this.collections.remove(me(p), groupId, id, ip(req));
  }

  /** The parish in the URL reviews its outstation's collection. */
  @Post("collections/:id/review")
  @HttpCode(204)
  async review(
    @Param("groupId", uuid) groupId: string,
    @Param("id", uuid) id: string,
    @Body(new ZodPipe(ReviewPendingCollectionSchema))
    b: z.output<typeof ReviewPendingCollectionSchema>,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    await this.collections.review(me(p), groupId, id, b.decision, b.note, ip(req));
  }

  @Post("collections/:id/retry")
  @HttpCode(204)
  async retry(
    @Param("groupId", uuid) groupId: string,
    @Param("id", uuid) id: string,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    await this.collections.retry(me(p), groupId, id, ip(req));
  }

  /** Read-only figures from the accounting service (functionality §4.12). */
  @Get("finance")
  finance(@Param("groupId", uuid) groupId: string) {
    return this.collections.finance(groupId);
  }
}
