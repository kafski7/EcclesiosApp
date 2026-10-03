import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, Req } from "@nestjs/common";
import {
  TeachingSearchQuerySchema,
  TeachingSlugSchema,
  TeachingStatusChangeSchema,
  TopicSlugSchema,
  UpsertTeachingSchema,
  UpsertTopicSchema,
  type Principal,
} from "@ecclesios/shared";
import type { Request } from "express";
import { z } from "zod";
import { CurrentPrincipal } from "../common/principal.decorator";
import { Public } from "../common/public.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { PlatformRole } from "../platform/platform-role";
import { TeachingsService } from "./teachings.service";

const slugPipe = new ZodPipe(TeachingSlugSchema);
const topicPipe = new ZodPipe(TopicSlugSchema);
const ip = (req: Request) => req.ip ?? "unknown";
const AdminQuery = z.object({ q: z.string().trim().max(100).default("") });

/** GET /api/public/teachings/* (functionality §3.7). */
@Public()
@Controller("public/teachings")
export class TeachingsController {
  constructor(private readonly teachings: TeachingsService) {}

  @Get("topics")
  async topics() {
    return { items: await this.teachings.topics() };
  }

  /** ?q=eucharist · ?topic=sacraments */
  @Get()
  list(@Query(new ZodPipe(TeachingSearchQuerySchema)) q: z.output<typeof TeachingSearchQuerySchema>) {
    return this.teachings.list(q.q, q.topic, q.page);
  }

  @Get(":slug")
  detail(@Param("slug", slugPipe) slug: string) {
    return this.teachings.detail(slug);
  }
}

/** Teachings are official catechesis: Super-Admins write and publish them (D-030). */
@PlatformRole("SUPER_ADMIN")
@Controller("platform/teachings")
export class TeachingsAdminController {
  constructor(private readonly teachings: TeachingsService) {}

  @Get("topics")
  async topics() {
    return { items: await this.teachings.topics(true) };
  }

  @Post("topics")
  @HttpCode(201)
  addTopic(@Body(new ZodPipe(UpsertTopicSchema)) b: z.output<typeof UpsertTopicSchema>) {
    return this.teachings.upsertTopic(null, b);
  }

  @Put("topics/:slug")
  updateTopic(@Param("slug", topicPipe) slug: string, @Body(new ZodPipe(UpsertTopicSchema)) b: z.output<typeof UpsertTopicSchema>) {
    return this.teachings.upsertTopic(slug, b);
  }

  @Delete("topics/:slug")
  removeTopic(@Param("slug", topicPipe) slug: string) {
    return this.teachings.removeTopic(slug);
  }

  @Get()
  async list(@Query(new ZodPipe(AdminQuery)) q: z.output<typeof AdminQuery>) {
    return { items: await this.teachings.adminList(q.q) };
  }

  @Get(":slug")
  detail(@Param("slug", slugPipe) slug: string) {
    return this.teachings.adminDetail(slug);
  }

  @Post()
  @HttpCode(201)
  create(
    @Body(new ZodPipe(UpsertTeachingSchema)) b: z.output<typeof UpsertTeachingSchema>,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    return this.teachings.upsert(p!.id, null, b, ip(req));
  }

  @Put(":slug")
  update(
    @Param("slug", slugPipe) slug: string,
    @Body(new ZodPipe(UpsertTeachingSchema)) b: z.output<typeof UpsertTeachingSchema>,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    return this.teachings.upsert(p!.id, slug, b, ip(req));
  }

  @Post(":slug/status")
  @HttpCode(200)
  status(
    @Param("slug", slugPipe) slug: string,
    @Body(new ZodPipe(TeachingStatusChangeSchema)) b: z.output<typeof TeachingStatusChangeSchema>,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    return this.teachings.setStatus(p!.id, slug, b.status, ip(req));
  }

  @Delete(":slug")
  @HttpCode(204)
  async remove(@Param("slug", slugPipe) slug: string, @CurrentPrincipal() p: Principal | undefined, @Req() req: Request) {
    await this.teachings.remove(p!.id, slug, ip(req));
  }
}
