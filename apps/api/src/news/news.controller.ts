import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, Req } from "@nestjs/common";
import { NewsQuerySchema, NewsSlugSchema, NewsStatusChangeSchema, UpsertNewsSchema, type Principal } from "@ecclesios/shared";
import type { Request } from "express";
import type { z } from "zod";
import { CurrentPrincipal } from "../common/principal.decorator";
import { Public } from "../common/public.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { PlatformRole } from "../platform/platform-role";
import { NewsService } from "./news.service";

const slugPipe = new ZodPipe(NewsSlugSchema);
const ip = (req: Request) => req.ip ?? "unknown";

/** GET /api/public/news/* (D-032). */
@Public()
@Controller("public/news")
export class NewsController {
  constructor(private readonly news: NewsService) {}

  @Get()
  list(@Query(new ZodPipe(NewsQuerySchema)) q: z.output<typeof NewsQuerySchema>) {
    return this.news.list(q.category, q.page);
  }

  @Get(":slug")
  detail(@Param("slug", slugPipe) slug: string) {
    return this.news.detail(slug);
  }
}

/** Platform news is written by Super-Admins (D-032). */
@PlatformRole("SUPER_ADMIN")
@Controller("platform/news")
export class NewsAdminController {
  constructor(private readonly news: NewsService) {}

  @Get()
  async list() {
    return { items: await this.news.adminList() };
  }

  @Get(":slug")
  detail(@Param("slug", slugPipe) slug: string) {
    return this.news.adminDetail(slug);
  }

  @Post()
  @HttpCode(201)
  create(@Body(new ZodPipe(UpsertNewsSchema)) b: z.output<typeof UpsertNewsSchema>, @CurrentPrincipal() p: Principal | undefined, @Req() req: Request) {
    return this.news.upsert(p!.id, null, b, ip(req));
  }

  @Put(":slug")
  update(
    @Param("slug", slugPipe) slug: string,
    @Body(new ZodPipe(UpsertNewsSchema)) b: z.output<typeof UpsertNewsSchema>,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    return this.news.upsert(p!.id, slug, b, ip(req));
  }

  @Post(":slug/status")
  @HttpCode(200)
  status(
    @Param("slug", slugPipe) slug: string,
    @Body(new ZodPipe(NewsStatusChangeSchema)) b: z.output<typeof NewsStatusChangeSchema>,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    return this.news.setStatus(p!.id, slug, b.status, b.publishAt, ip(req));
  }

  @Delete(":slug")
  @HttpCode(204)
  async remove(@Param("slug", slugPipe) slug: string, @CurrentPrincipal() p: Principal | undefined, @Req() req: Request) {
    await this.news.remove(p!.id, slug, ip(req));
  }
}
