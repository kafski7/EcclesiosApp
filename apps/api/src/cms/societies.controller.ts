import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
} from "@nestjs/common";
import {
  AddToRosterSchema,
  CandidatesQuerySchema,
  CreateSocietySchema,
  SetPositionSchema,
  SocietiesQuerySchema,
  UpsertSocietySchema,
  type Principal,
} from "@ecclesios/shared";
import type { Request } from "express";
import type { z } from "zod";
import { DomainError } from "../auth/core/errors";
import { CurrentPrincipal } from "../common/principal.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { Scope } from "../rbac/scope";
import { RequiresSubscription } from "../subscriptions/requires-subscription";
import { SocietiesService } from "./societies.service";

const uuid = new ParseUUIDPipe({
  exceptionFactory: () => new DomainError(400, "VALIDATION_FAILED", "Invalid id."),
});
const ip = (req: Request) => req.ip ?? "unknown";
const me = (p: Principal | undefined) => p!.id;

/**
 * Societies & committees (functionality §4.4–4.5, D-038). Every route needs `memberContent` in the
 * church (its members, staff and parish); the service then allows staff to manage, the society's
 * leader to keep the roster, and the parish to read.
 */
@Controller("cms/groups/:groupId/societies")
@Scope({ need: "memberContent" })
@RequiresSubscription()
export class SocietiesController {
  constructor(private readonly societies: SocietiesService) {}

  @Get()
  list(
    @Param("groupId", uuid) groupId: string,
    @Query(new ZodPipe(SocietiesQuerySchema)) q: z.output<typeof SocietiesQuerySchema>,
    @CurrentPrincipal() p: Principal | undefined,
  ) {
    return this.societies.list(me(p), groupId, q.kind, q.archived === "1");
  }

  @Post()
  @HttpCode(201)
  create(
    @Param("groupId", uuid) groupId: string,
    @Body(new ZodPipe(CreateSocietySchema)) b: z.output<typeof CreateSocietySchema>,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    return this.societies.create(me(p), groupId, b, ip(req));
  }

  @Get(":id")
  detail(
    @Param("groupId", uuid) groupId: string,
    @Param("id", uuid) id: string,
    @CurrentPrincipal() p: Principal | undefined,
  ) {
    return this.societies.detail(me(p), groupId, id);
  }

  @Get(":id/roster.csv")
  @Header("content-type", "text/csv; charset=utf-8")
  @Header("content-disposition", 'attachment; filename="roster.csv"')
  csv(
    @Param("groupId", uuid) groupId: string,
    @Param("id", uuid) id: string,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    return this.societies.rosterCsv(me(p), groupId, id, ip(req));
  }

  @Put(":id")
  update(
    @Param("groupId", uuid) groupId: string,
    @Param("id", uuid) id: string,
    @Body(new ZodPipe(UpsertSocietySchema)) b: z.output<typeof UpsertSocietySchema>,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    return this.societies.update(me(p), groupId, id, b, ip(req));
  }

  @Post(":id/archive")
  @HttpCode(200)
  archive(
    @Param("groupId", uuid) groupId: string,
    @Param("id", uuid) id: string,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    return this.societies.setActive(me(p), groupId, id, false, ip(req));
  }

  @Post(":id/restore")
  @HttpCode(200)
  restore(
    @Param("groupId", uuid) groupId: string,
    @Param("id", uuid) id: string,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    return this.societies.setActive(me(p), groupId, id, true, ip(req));
  }

  @Delete(":id")
  @HttpCode(204)
  async remove(
    @Param("groupId", uuid) groupId: string,
    @Param("id", uuid) id: string,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    await this.societies.remove(me(p), groupId, id, ip(req));
  }

  @Get(":id/candidates")
  candidates(
    @Param("groupId", uuid) groupId: string,
    @Param("id", uuid) id: string,
    @Query(new ZodPipe(CandidatesQuerySchema)) q: z.output<typeof CandidatesQuerySchema>,
    @CurrentPrincipal() p: Principal | undefined,
  ) {
    return this.societies.candidates(me(p), groupId, id, q.q);
  }

  @Post(":id/roster")
  @HttpCode(201)
  add(
    @Param("groupId", uuid) groupId: string,
    @Param("id", uuid) id: string,
    @Body(new ZodPipe(AddToRosterSchema)) b: z.output<typeof AddToRosterSchema>,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    return this.societies.addToRoster(me(p), groupId, id, b.personId, b.position, ip(req));
  }

  @Put(":id/roster/:personId")
  position(
    @Param("groupId", uuid) groupId: string,
    @Param("id", uuid) id: string,
    @Param("personId", uuid) personId: string,
    @Body(new ZodPipe(SetPositionSchema)) b: z.output<typeof SetPositionSchema>,
    @CurrentPrincipal() p: Principal | undefined,
  ) {
    return this.societies.setPosition(me(p), groupId, id, personId, b.position);
  }

  @Delete(":id/roster/:personId")
  removeFromRoster(
    @Param("groupId", uuid) groupId: string,
    @Param("id", uuid) id: string,
    @Param("personId", uuid) personId: string,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    return this.societies.removeFromRoster(me(p), groupId, id, personId, ip(req));
  }
}
