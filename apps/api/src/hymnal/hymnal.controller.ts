import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req } from "@nestjs/common";
import {
  AddMediaSchema,
  HymnSearchQuerySchema,
  HymnSlugSchema,
  PresignUploadSchema,
  UpdateMediaSchema,
  UpsertHymnSchema,
  UpsertTuneSchema,
  type Principal,
} from "@ecclesios/shared";
import type { Request } from "express";
import { z } from "zod";
import { DomainError } from "../auth/core/errors";
import { CurrentPrincipal } from "../common/principal.decorator";
import { Public } from "../common/public.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { PlatformRole } from "../platform/platform-role";
import { HymnalService } from "./hymnal.service";

const uuid = new ParseUUIDPipe({ exceptionFactory: () => new DomainError(400, "VALIDATION_FAILED", "Invalid id.") });
const slugPipe = new ZodPipe(HymnSlugSchema);
const ip = (req: Request) => req.ip ?? "unknown";
const CountryQuery = z.object({ country: z.string().regex(/^[A-Z]{2}$/).optional() });
const UrlQuery = z.object({ download: z.enum(["0", "1"]).optional() });
const AdminListQuery = z.object({ q: z.string().trim().max(100).default("") });

/**
 * Public signed-out viewer. Personal subscriptions don't exist yet, so the public API sees everyone
 * as a non-subscriber; with LISTENER_PAYWALL off (default) every item is open anyway (D-026).
 */
const PUBLIC_VIEWER = { staff: false, subscribed: false };

/** GET /api/public/hymnal/* (functionality §3.6). */
@Public()
@Controller("public/hymnal")
export class HymnalController {
  constructor(private readonly hymnal: HymnalService) {}

  @Get("books")
  async books() {
    return { items: await this.hymnal.books() };
  }

  /** ?q=512 · ?q=NCH 512 · ?q=silent night · ?book=NCH (browse in book order) · ?tag=advent */
  @Get("hymns")
  search(@Query(new ZodPipe(HymnSearchQuerySchema)) q: z.output<typeof HymnSearchQuerySchema>) {
    return this.hymnal.search(q.q, q);
  }

  @Get("hymns/:slug")
  bySlug(@Param("slug", slugPipe) slug: string, @Query(new ZodPipe(CountryQuery)) q: z.output<typeof CountryQuery>) {
    return this.hymnal.bySlug(slug, q.country ?? null, PUBLIC_VIEWER);
  }

  /** Short-lived stream/download URL for an uploaded file. ?download=1 sets a file name. */
  @Get("media/:id/url")
  url(@Param("id", uuid) id: string, @Query(new ZodPipe(UrlQuery)) q: z.output<typeof UrlQuery>) {
    return this.hymnal.mediaUrl(id, PUBLIC_VIEWER, q.download === "1");
  }
}

/** Super-Admin hymnal management (todo P5.4). */
@PlatformRole("SUPER_ADMIN")
@Controller("platform/hymnal")
export class HymnalAdminController {
  constructor(private readonly hymnal: HymnalService) {}

  @Get("hymns")
  async list(@Query(new ZodPipe(AdminListQuery)) q: z.output<typeof AdminListQuery>) {
    return { items: await this.hymnal.adminList(q.q) };
  }

  @Get("hymns/:slug")
  detail(@Param("slug", slugPipe) slug: string) {
    return this.hymnal.adminDetail(slug);
  }

  @Post("hymns")
  @HttpCode(201)
  create(
    @Body(new ZodPipe(UpsertHymnSchema)) body: z.output<typeof UpsertHymnSchema>,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    return this.hymnal.upsert(p!.id, null, body, ip(req));
  }

  @Put("hymns/:slug")
  update(
    @Param("slug", slugPipe) slug: string,
    @Body(new ZodPipe(UpsertHymnSchema)) body: z.output<typeof UpsertHymnSchema>,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    return this.hymnal.upsert(p!.id, slug, body, ip(req));
  }

  @Post("hymns/:slug/tunes")
  @HttpCode(201)
  addTune(@Param("slug", slugPipe) slug: string, @Body(new ZodPipe(UpsertTuneSchema)) body: z.output<typeof UpsertTuneSchema>) {
    return this.hymnal.addTune(slug, body);
  }

  @Put("hymns/:slug/tunes/:tuneId")
  updateTune(
    @Param("slug", slugPipe) slug: string,
    @Param("tuneId", uuid) tuneId: string,
    @Body(new ZodPipe(UpsertTuneSchema)) body: z.output<typeof UpsertTuneSchema>,
  ) {
    return this.hymnal.updateTune(slug, tuneId, body);
  }

  @Delete("hymns/:slug/tunes/:tuneId")
  removeTune(@Param("slug", slugPipe) slug: string, @Param("tuneId", uuid) tuneId: string) {
    return this.hymnal.removeTune(slug, tuneId);
  }

  /** Step 1: presigned PUT. The browser uploads straight to storage. */
  @Post("hymns/:slug/tunes/:tuneId/uploads")
  @HttpCode(201)
  presign(
    @Param("slug", slugPipe) slug: string,
    @Param("tuneId", uuid) tuneId: string,
    @Body(new ZodPipe(PresignUploadSchema)) body: z.output<typeof PresignUploadSchema>,
  ) {
    return this.hymnal.presignUpload(slug, tuneId, body.kind, body.contentType, body.bytes);
  }

  /** Step 2: register the uploaded file, or add a YouTube link. */
  @Post("hymns/:slug/tunes/:tuneId/media")
  @HttpCode(201)
  addMedia(
    @Param("slug", slugPipe) slug: string,
    @Param("tuneId", uuid) tuneId: string,
    @Body(new ZodPipe(AddMediaSchema)) body: z.output<typeof AddMediaSchema>,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    return this.hymnal.addMedia(p!.id, slug, tuneId, body, ip(req));
  }

  @Patch("hymns/:slug/media/:mediaId")
  updateMedia(
    @Param("slug", slugPipe) slug: string,
    @Param("mediaId", uuid) mediaId: string,
    @Body(new ZodPipe(UpdateMediaSchema)) body: z.output<typeof UpdateMediaSchema>,
  ) {
    return this.hymnal.updateMedia(slug, mediaId, body);
  }

  @Delete("hymns/:slug/media/:mediaId")
  removeMedia(
    @Param("slug", slugPipe) slug: string,
    @Param("mediaId", uuid) mediaId: string,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    return this.hymnal.removeMedia(p!.id, slug, mediaId, ip(req));
  }
}
