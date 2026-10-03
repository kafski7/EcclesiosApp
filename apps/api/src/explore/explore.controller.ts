import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, Req } from "@nestjs/common";
import {
  AttachPostCoverSchema,
  CommentStatusChangeSchema,
  ExploreQuerySchema,
  MentionQuerySchema,
  NewCommentSchema,
  PostDecisionSchema,
  PostUploadSchema,
  UpdateChurchProfileSchema,
  UpsertPostSchema,
  type PostDecision,
  type Principal,
} from "@ecclesios/shared";
import type { Request } from "express";
import type { z } from "zod";
import { DomainError } from "../auth/core/errors";
import { CurrentPrincipal } from "../common/principal.decorator";
import { Public } from "../common/public.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { PlatformRole } from "../platform/platform-role";
import { ChurchPagesService } from "./churches.service";
import { CommentsService } from "./comments.service";
import { ExploreService } from "./explore.service";

const uuid = new ParseUUIDPipe({ exceptionFactory: () => new DomainError(400, "VALIDATION_FAILED", "Invalid id.") });
const ip = (req: Request) => req.ip ?? "unknown";
const member = (p: Principal | undefined) => {
  if (p?.kind !== "member") throw new DomainError(403, "NOT_ALLOWED", "Comments are for member accounts.");
  return p.id;
};

/** Public reading (functionality §3.4). A valid token, if sent, personalises the answer. */
@Public()
@Controller("public/explore")
export class ExplorePublicController {
  constructor(
    private readonly explore: ExploreService,
    private readonly comments: CommentsService,
    private readonly churches: ChurchPagesService,
  ) {}

  /** ?kind=EVENT&past=1 · ?church=<id> · ?following=1 · ?q= */
  @Get("posts")
  list(@Query(new ZodPipe(ExploreQuerySchema)) q: z.output<typeof ExploreQuerySchema>, @CurrentPrincipal() p: Principal | undefined) {
    return this.explore.list(q, p);
  }

  @Get("posts/:id")
  detail(@Param("id", uuid) id: string) {
    return this.explore.detail(id);
  }

  @Get("posts/:id/comments")
  postComments(@Param("id", uuid) id: string, @CurrentPrincipal() p: Principal | undefined) {
    return this.comments.list(id, p);
  }

  @Get("churches/:id")
  church(@Param("id", uuid) id: string, @CurrentPrincipal() p: Principal | undefined) {
    return this.churches.profile(id, p);
  }
}

/** Signed-in actions: comments, church pages, authoring (D-017, D-031). */
@Controller("explore")
export class ExploreController {
  constructor(
    private readonly explore: ExploreService,
    private readonly comments: CommentsService,
    private readonly churches: ChurchPagesService,
  ) {}

  // comments
  @Post("posts/:id/comments")
  @HttpCode(201)
  addComment(
    @Param("id", uuid) id: string,
    @Body(new ZodPipe(NewCommentSchema)) b: z.output<typeof NewCommentSchema>,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    return this.comments.add(member(p), id, b.body, ip(req));
  }

  /** @mention suggestions while writing a comment (D-035). */
  @Get("posts/:id/mention-suggestions")
  mentionSuggestions(
    @Param("id", uuid) id: string,
    @Query(new ZodPipe(MentionQuerySchema)) q: z.output<typeof MentionQuerySchema>,
    @CurrentPrincipal() p: Principal | undefined,
  ) {
    return this.comments.suggestions(member(p), id, q.q);
  }

  @Delete("comments/:id")
  @HttpCode(204)
  async deleteComment(@Param("id", uuid) id: string, @CurrentPrincipal() p: Principal | undefined) {
    await this.comments.remove(member(p), id);
  }

  @Post("comments/:id/report")
  @HttpCode(204)
  async report(@Param("id", uuid) id: string, @CurrentPrincipal() p: Principal | undefined, @Req() req: Request) {
    await this.comments.report(member(p), id, ip(req));
  }

  @Put("comments/:id/status")
  @HttpCode(204)
  async commentStatus(
    @Param("id", uuid) id: string,
    @Body(new ZodPipe(CommentStatusChangeSchema)) b: z.output<typeof CommentStatusChangeSchema>,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    await this.comments.setStatus(p!, id, b.status, ip(req));
  }

  // church pages
  @Put("churches/:id")
  updateChurch(
    @Param("id", uuid) id: string,
    @Body(new ZodPipe(UpdateChurchProfileSchema)) b: z.output<typeof UpdateChurchProfileSchema>,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    return this.churches.update(p!, id, b, ip(req));
  }

  @Post("churches/:id/cover-upload")
  @HttpCode(201)
  churchCoverUpload(
    @Param("id", uuid) id: string,
    @Body(new ZodPipe(PostUploadSchema)) b: z.output<typeof PostUploadSchema>,
    @CurrentPrincipal() p: Principal | undefined,
  ) {
    return this.churches.presignCover(p!, id, b.contentType, b.bytes);
  }

  @Put("churches/:id/cover")
  churchCover(
    @Param("id", uuid) id: string,
    @Body(new ZodPipe(AttachPostCoverSchema)) b: z.output<typeof AttachPostCoverSchema>,
    @CurrentPrincipal() p: Principal | undefined,
  ) {
    return this.churches.setCover(p!, id, b.key);
  }

  // authoring
  @Get("authoring")
  options(@CurrentPrincipal() p: Principal | undefined) {
    return this.explore.options(p!);
  }

  @Get("my-posts")
  mine(@CurrentPrincipal() p: Principal | undefined) {
    return this.explore.myPosts(p!);
  }

  @Get("my-posts/:id")
  myPost(@Param("id", uuid) id: string, @CurrentPrincipal() p: Principal | undefined) {
    return this.explore.myPost(p!, id);
  }

  @Post("my-posts")
  @HttpCode(201)
  create(
    @Body(new ZodPipe(UpsertPostSchema)) b: z.output<typeof UpsertPostSchema>,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    return this.explore.create(p!, b, ip(req));
  }

  @Put("my-posts/:id")
  update(
    @Param("id", uuid) id: string,
    @Body(new ZodPipe(UpsertPostSchema)) b: z.output<typeof UpsertPostSchema>,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    return this.explore.update(p!, id, b, ip(req));
  }

  @Post("my-posts/:id/submit")
  @HttpCode(200)
  submit(@Param("id", uuid) id: string, @CurrentPrincipal() p: Principal | undefined, @Req() req: Request) {
    return this.explore.submit(p!, id, ip(req));
  }

  @Delete("my-posts/:id")
  @HttpCode(204)
  async remove(@Param("id", uuid) id: string, @CurrentPrincipal() p: Principal | undefined, @Req() req: Request) {
    await this.explore.remove(p!, id, ip(req));
  }

  @Post("my-posts/:id/cover-upload")
  @HttpCode(201)
  coverUpload(
    @Param("id", uuid) id: string,
    @Body(new ZodPipe(PostUploadSchema)) b: z.output<typeof PostUploadSchema>,
    @CurrentPrincipal() p: Principal | undefined,
  ) {
    return this.explore.presignCover(p!, id, b.contentType, b.bytes);
  }

  @Put("my-posts/:id/cover")
  cover(
    @Param("id", uuid) id: string,
    @Body(new ZodPipe(AttachPostCoverSchema)) b: z.output<typeof AttachPostCoverSchema>,
    @CurrentPrincipal() p: Principal | undefined,
  ) {
    return this.explore.setCover(p!, id, b.key);
  }
}

/** Moderation queue (functionality §3.4, §6) — Super-Admins only. */
@Controller("platform/explore")
@PlatformRole("SUPER_ADMIN")
export class ExploreModerationController {
  constructor(
    private readonly explore: ExploreService,
    private readonly comments: CommentsService,
  ) {}

  @Get("queue")
  queue() {
    return this.explore.queue();
  }

  @Post("posts/:id/decision")
  @HttpCode(200)
  decide(
    @Param("id", uuid) id: string,
    @Body(new ZodPipe(PostDecisionSchema)) d: PostDecision,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    return this.explore.decide(p!.id, id, d, ip(req));
  }

  @Get("reported-comments")
  reported() {
    return this.comments.reported();
  }
}
