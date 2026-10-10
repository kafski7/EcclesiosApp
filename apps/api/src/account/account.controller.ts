import { Body, Controller, Get, HttpCode, Post, Put, Query, Req } from "@nestjs/common";
import {
  AttachPhotoSchema,
  ChangePasswordSchema,
  NotificationQuerySchema,
  PhotoUploadSchema,
  UpdateNotificationPreferencesSchema,
  UpdateOwnProfileSchema,
  type Principal,
} from "@ecclesios/shared";
import type { Request } from "express";
import { z } from "zod";
import { AuthService } from "../auth/auth.service";
import { DomainError } from "../auth/core/errors";
import { CurrentPrincipal } from "../common/principal.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { PreferencesService } from "../notify/preferences.service";
import { AccountService } from "./account.service";

const ip = (req: Request) => req.ip ?? req.socket.remoteAddress ?? "unknown";
const signedIn = (p: Principal | undefined) => {
  if (!p) throw new DomainError(401, "UNAUTHENTICATED", "Please sign in.");
  return p;
};
const member = (p: Principal | undefined) => {
  if (p?.kind !== "member")
    throw new DomainError(403, "NOT_ALLOWED", "Only member accounts have a profile here.");
  return p.id;
};
const MarkReadSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100).optional(),
  church: z.string().uuid().optional(),
});
const UnreadQuerySchema = z.object({ church: z.string().uuid().optional() });

/** /api/me/* — the signed-in person's own account (functionality §4.6, §4.9, D-039; preferences D-052). */
@Controller("me")
export class AccountController {
  constructor(
    private readonly account: AccountService,
    private readonly auth: AuthService,
    private readonly prefs: PreferencesService,
  ) {}

  @Get("profile")
  profile(@CurrentPrincipal() p: Principal | undefined) {
    return this.account.profile(member(p));
  }

  @Put("profile")
  update(
    @Body(new ZodPipe(UpdateOwnProfileSchema)) b: z.output<typeof UpdateOwnProfileSchema>,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    return this.account.updateProfile(member(p), b, ip(req));
  }

  @Post("photo-upload")
  @HttpCode(201)
  photoUpload(
    @Body(new ZodPipe(PhotoUploadSchema)) b: z.output<typeof PhotoUploadSchema>,
    @CurrentPrincipal() p: Principal | undefined,
  ) {
    return this.account.presignPhoto(member(p), b.contentType, b.bytes);
  }

  @Put("photo")
  photo(
    @Body(new ZodPipe(AttachPhotoSchema)) b: z.output<typeof AttachPhotoSchema>,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    return this.account.setPhoto(member(p), b.key, ip(req));
  }

  /** Members and platform accounts. Returns a fresh token pair; other sessions end. */
  @Post("password")
  @HttpCode(200)
  password(
    @Body(new ZodPipe(ChangePasswordSchema)) b: z.output<typeof ChangePasswordSchema>,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    const who = signedIn(p);
    return this.auth.changePassword(who.kind, who.id, b.currentPassword, b.newPassword, {
      ip: ip(req),
    });
  }

  @Get("notifications")
  notifications(
    @Query(new ZodPipe(NotificationQuerySchema)) q: z.output<typeof NotificationQuerySchema>,
    @CurrentPrincipal() p: Principal | undefined,
  ) {
    return this.account.list(signedIn(p), {
      unread: q.unread === "1",
      church: q.church,
      page: q.page,
    });
  }

  @Get("notifications/unread")
  async unread(
    @Query(new ZodPipe(UnreadQuerySchema)) q: z.output<typeof UnreadQuerySchema>,
    @CurrentPrincipal() p: Principal | undefined,
  ) {
    return { unread: await this.account.unread(signedIn(p), q.church) };
  }

  /** { ids } marks those; no ids marks all (optionally only one church's). */
  @Post("notifications/read")
  @HttpCode(200)
  read(
    @Body(new ZodPipe(MarkReadSchema)) b: z.output<typeof MarkReadSchema>,
    @CurrentPrincipal() p: Principal | undefined,
  ) {
    return this.account.markRead(signedIn(p), b.ids ?? "all", b.church);
  }

  /** Which notifications you get (D-052). Members only; no row = on. */
  @Get("notification-preferences")
  preferences(@CurrentPrincipal() p: Principal | undefined) {
    return this.prefs.get(member(p));
  }

  @Put("notification-preferences")
  savePreferences(
    @Body(new ZodPipe(UpdateNotificationPreferencesSchema))
    b: z.output<typeof UpdateNotificationPreferencesSchema>,
    @CurrentPrincipal() p: Principal | undefined,
  ) {
    return this.prefs.update(member(p), b);
  }
}
