import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Req,
} from "@nestjs/common";
import {
  SaintSearchQuerySchema,
  SaintSlugSchema,
  SaintsTodayQuerySchema,
  UpsertSaintSchema,
  type Principal,
  type Saint,
  type SaintSummary,
  type SaintsToday,
} from "@ecclesios/shared";
import { toIsoDate } from "@ecclesios/shared/domain";
import type { Request } from "express";
import { z } from "zod";
import { CurrentPrincipal } from "../common/principal.decorator";
import { Public } from "../common/public.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { PlatformRole } from "../platform/platform-role";
import { SaintsService } from "./saints.service";

@Controller()
export class SaintsController {
  constructor(private readonly saints: SaintsService) {}

  /** GET /api/public/saints/today?date=YYYY-MM-DD — send the reader's local date; defaults to UTC today. */
  @Public()
  @Get("public/saints/today")
  today(
    @Query(new ZodPipe(SaintsTodayQuerySchema)) q: z.output<typeof SaintsTodayQuerySchema>,
  ): Promise<SaintsToday> {
    return this.saints.today(q.date ?? toIsoDate(new Date()));
  }

  /** GET /api/public/saints?q=&month= — the directory, in calendar order. */
  @Public()
  @Get("public/saints")
  async list(
    @Query(new ZodPipe(SaintSearchQuerySchema)) q: z.output<typeof SaintSearchQuerySchema>,
  ): Promise<{ items: SaintSummary[] }> {
    return { items: await this.saints.list(q.q, q.month) };
  }

  @Public()
  @Get("public/saints/:slug")
  bySlug(@Param("slug", new ZodPipe(SaintSlugSchema)) slug: string): Promise<Saint> {
    return this.saints.bySlug(slug);
  }

  @PlatformRole("SUPER_ADMIN")
  @Put("platform/saints/:slug")
  upsert(
    @Param("slug", new ZodPipe(SaintSlugSchema)) slug: string,
    @Body(new ZodPipe(UpsertSaintSchema)) body: z.output<typeof UpsertSaintSchema>,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    return this.saints.upsert(p!.id, slug, body, req.ip ?? "unknown");
  }

  /** Portrait upload, step 1: presigned PUT (JPEG/PNG/WebP, max 5 MB). */
  @PlatformRole("SUPER_ADMIN")
  @Post("platform/saints/:slug/portrait-upload")
  @HttpCode(201)
  presignPortrait(
    @Param("slug", new ZodPipe(SaintSlugSchema)) slug: string,
    @Body(
      new ZodPipe(z.object({ contentType: z.string().max(100), bytes: z.number().int().min(1) })),
    )
    b: { contentType: string; bytes: number },
  ) {
    return this.saints.presignPortrait(slug, b.contentType, b.bytes);
  }

  /** Step 2: attach the uploaded image. */
  @PlatformRole("SUPER_ADMIN")
  @Put("platform/saints/:slug/portrait")
  setPortrait(
    @Param("slug", new ZodPipe(SaintSlugSchema)) slug: string,
    @Body(new ZodPipe(z.object({ key: z.string().min(5).max(300) }))) b: { key: string },
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    return this.saints.setPortrait(p!.id, slug, b.key, req.ip ?? "unknown");
  }

  @PlatformRole("SUPER_ADMIN")
  @Delete("platform/saints/:slug/portrait")
  removePortrait(
    @Param("slug", new ZodPipe(SaintSlugSchema)) slug: string,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    return this.saints.setPortrait(p!.id, slug, null, req.ip ?? "unknown");
  }
}
