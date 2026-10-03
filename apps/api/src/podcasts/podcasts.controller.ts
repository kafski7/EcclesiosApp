import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, Req } from "@nestjs/common";
import {
  AddAttachmentSchema,
  AttachAudioSchema,
  AttachmentUploadSchema,
  EpisodeYouTubeSchema,
  AttachCoverSchema,
  CoverUploadSchema,
  EpisodeStatusChangeSchema,
  EpisodeUploadSchema,
  PodcastSearchQuerySchema,
  PodcastSlugSchema,
  UpsertEpisodeSchema,
  UpsertPodcastSchema,
  type Principal,
} from "@ecclesios/shared";
import type { Request } from "express";
import type { z } from "zod";
import { DomainError } from "../auth/core/errors";
import { CurrentPrincipal } from "../common/principal.decorator";
import { Public } from "../common/public.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { PodcastsService } from "./podcasts.service";

const uuid = new ParseUUIDPipe({ exceptionFactory: () => new DomainError(400, "VALIDATION_FAILED", "Invalid id.") });
const slugPipe = new ZodPipe(PodcastSlugSchema);
const ip = (req: Request) => req.ip ?? "unknown";
const member = (p: Principal | undefined) => {
  if (p?.kind !== "member") throw new DomainError(403, "NOT_ALLOWED", "Following is for member accounts.");
  return p.id;
};

/** GET /api/public/podcasts/* — listening is public (functionality §3.5). */
@Public()
@Controller("public/podcasts")
export class PodcastsPublicController {
  constructor(private readonly podcasts: PodcastsService) {}

  @Get()
  list(@Query(new ZodPipe(PodcastSearchQuerySchema)) q: z.output<typeof PodcastSearchQuerySchema>) {
    return this.podcasts.list(q.q, q.category, q.page);
  }

  @Get("episodes/:id/url")
  url(@Param("id", uuid) id: string) {
    return this.podcasts.episodeUrl(id);
  }

  @Get("episodes/:id/transcript")
  transcript(@Param("id", uuid) id: string) {
    return this.podcasts.transcript(id);
  }

  @Get("attachments/:id/url")
  attachment(@Param("id", uuid) id: string) {
    return this.podcasts.attachmentUrl(id);
  }

  @Get(":slug")
  detail(@Param("slug", slugPipe) slug: string) {
    return this.podcasts.detail(slug);
  }
}

/** Follows (members). New episodes notify followers (D-027). */
@Controller("podcasts")
export class PodcastFollowsController {
  constructor(private readonly podcasts: PodcastsService) {}

  @Get("following")
  following(@CurrentPrincipal() p: Principal | undefined) {
    return this.podcasts.following(member(p));
  }

  @Put(":slug/follow")
  @HttpCode(204)
  async follow(@Param("slug", slugPipe) slug: string, @CurrentPrincipal() p: Principal | undefined) {
    await this.podcasts.follow(member(p), slug);
  }

  @Delete(":slug/follow")
  @HttpCode(204)
  async unfollow(@Param("slug", slugPipe) slug: string, @CurrentPrincipal() p: Principal | undefined) {
    await this.podcasts.unfollow(member(p), slug);
  }
}

/**
 * Publishing studio: Super-Admins and holders of POST_PODCASTS, members or platform accounts.
 * Rules in @ecclesios/shared/domain/podcasts.ts.
 */
@Controller("studio/podcasts")
export class PodcastStudioController {
  constructor(private readonly podcasts: PodcastsService) {}

  @Get()
  list(@CurrentPrincipal() p: Principal | undefined) {
    return this.podcasts.studioList(p!);
  }

  @Post()
  @HttpCode(201)
  create(
    @Body(new ZodPipe(UpsertPodcastSchema)) body: z.output<typeof UpsertPodcastSchema>,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    return this.podcasts.create(p!, body, ip(req));
  }

  @Get(":slug")
  detail(@Param("slug", slugPipe) slug: string, @CurrentPrincipal() p: Principal | undefined) {
    return this.podcasts.studioDetail(p!, slug);
  }

  @Put(":slug")
  update(
    @Param("slug", slugPipe) slug: string,
    @Body(new ZodPipe(UpsertPodcastSchema)) body: z.output<typeof UpsertPodcastSchema>,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    return this.podcasts.update(p!, slug, body, ip(req));
  }

  @Post(":slug/cover-upload")
  @HttpCode(201)
  coverUpload(
    @Param("slug", slugPipe) slug: string,
    @Body(new ZodPipe(CoverUploadSchema)) b: z.output<typeof CoverUploadSchema>,
    @CurrentPrincipal() p: Principal | undefined,
  ) {
    return this.podcasts.presignCover(p!, slug, b.contentType, b.bytes);
  }

  @Put(":slug/cover")
  cover(
    @Param("slug", slugPipe) slug: string,
    @Body(new ZodPipe(AttachCoverSchema)) b: z.output<typeof AttachCoverSchema>,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    return this.podcasts.setCover(p!, slug, b.key, ip(req));
  }

  @Post(":slug/episodes")
  @HttpCode(201)
  addEpisode(
    @Param("slug", slugPipe) slug: string,
    @Body(new ZodPipe(UpsertEpisodeSchema)) body: z.output<typeof UpsertEpisodeSchema>,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    return this.podcasts.addEpisode(p!, slug, body, ip(req));
  }

  @Put(":slug/episodes/:id")
  updateEpisode(
    @Param("slug", slugPipe) slug: string,
    @Param("id", uuid) id: string,
    @Body(new ZodPipe(UpsertEpisodeSchema)) body: z.output<typeof UpsertEpisodeSchema>,
    @CurrentPrincipal() p: Principal | undefined,
  ) {
    return this.podcasts.updateEpisode(p!, slug, id, body);
  }

  /** Step 1: presigned PUT; the browser uploads straight to storage. */
  @Post(":slug/episodes/:id/upload")
  @HttpCode(201)
  upload(
    @Param("slug", slugPipe) slug: string,
    @Param("id", uuid) id: string,
    @Body(new ZodPipe(EpisodeUploadSchema)) b: z.output<typeof EpisodeUploadSchema>,
    @CurrentPrincipal() p: Principal | undefined,
  ) {
    return this.podcasts.presignAudio(p!, slug, id, b.contentType, b.bytes);
  }

  /** Step 2: attach the uploaded audio. */
  @Put(":slug/episodes/:id/audio")
  audio(
    @Param("slug", slugPipe) slug: string,
    @Param("id", uuid) id: string,
    @Body(new ZodPipe(AttachAudioSchema)) b: z.output<typeof AttachAudioSchema>,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    return this.podcasts.attachAudio(p!, slug, id, b.key, b.durationSec, ip(req));
  }

  /** YouTube / YouTube Music link (D-029); null clears it. */
  @Put(":slug/episodes/:id/youtube")
  youtube(
    @Param("slug", slugPipe) slug: string,
    @Param("id", uuid) id: string,
    @Body(new ZodPipe(EpisodeYouTubeSchema)) b: z.output<typeof EpisodeYouTubeSchema>,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    return this.podcasts.setYouTube(p!, slug, id, b.url, ip(req));
  }

  /** Handouts (PDF), step 1: presigned PUT. */
  @Post(":slug/episodes/:id/attachment-upload")
  @HttpCode(201)
  attachmentUpload(
    @Param("slug", slugPipe) slug: string,
    @Param("id", uuid) id: string,
    @Body(new ZodPipe(AttachmentUploadSchema)) b: z.output<typeof AttachmentUploadSchema>,
    @CurrentPrincipal() p: Principal | undefined,
  ) {
    return this.podcasts.presignAttachment(p!, slug, id, b.contentType, b.bytes);
  }

  /** Step 2: register the uploaded handout. */
  @Post(":slug/episodes/:id/attachments")
  @HttpCode(201)
  addAttachment(
    @Param("slug", slugPipe) slug: string,
    @Param("id", uuid) id: string,
    @Body(new ZodPipe(AddAttachmentSchema)) b: z.output<typeof AddAttachmentSchema>,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    return this.podcasts.addAttachment(p!, slug, id, b.key, b.label, ip(req));
  }

  @Delete(":slug/attachments/:attachmentId")
  removeAttachment(
    @Param("slug", slugPipe) slug: string,
    @Param("attachmentId", uuid) attachmentId: string,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    return this.podcasts.removeAttachment(p!, slug, attachmentId, ip(req));
  }

  @Post(":slug/episodes/:id/status")
  @HttpCode(200)
  status(
    @Param("slug", slugPipe) slug: string,
    @Param("id", uuid) id: string,
    @Body(new ZodPipe(EpisodeStatusChangeSchema)) b: z.output<typeof EpisodeStatusChangeSchema>,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    return this.podcasts.setStatus(p!, slug, id, b.status, ip(req));
  }

  @Delete(":slug/episodes/:id")
  remove(
    @Param("slug", slugPipe) slug: string,
    @Param("id", uuid) id: string,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    return this.podcasts.removeEpisode(p!, slug, id, ip(req));
  }
}
