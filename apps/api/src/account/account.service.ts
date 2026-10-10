import { Inject, Injectable } from "@nestjs/common";
import { groups, members, memberships, notifications, notificationTypes } from "@ecclesios/db";
import type {
  Notification,
  OwnProfile,
  Principal,
  UpdateOwnProfileSchema,
} from "@ecclesios/shared";
import { safeInternalLink } from "@ecclesios/shared/domain";
import { and, desc, eq, inArray, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import type { z } from "zod";
import { AuditService } from "../audit/audit.service";
import { DomainError } from "../auth/core/errors";
import { DB, type Database } from "../db/db.module";
import { MediaService } from "../media/media.service";

type UpdateOwn = z.output<typeof UpdateOwnProfileSchema>;
const PAGE = 20;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** The signed-in person's own profile and notifications (functionality §4.6, §4.9, D-039). */
@Injectable()
export class AccountService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly media: MediaService,
    private readonly audit: AuditService,
  ) {}

  // ------------------------------------------------------------------ profile (members)

  async profile(memberId: string): Promise<OwnProfile> {
    const [p] = await this.db.select().from(members).where(eq(members.id, memberId)).limit(1);
    if (!p) throw new DomainError(404, "NOT_FOUND", "Account not found.");
    const [home] = await this.db
      .select({ id: groups.id, name: groups.name })
      .from(memberships)
      .innerJoin(groups, eq(groups.id, memberships.groupId))
      .where(and(eq(memberships.memberId, memberId), eq(memberships.isHome, true)))
      .limit(1);
    return {
      id: p.id,
      firstName: p.firstName,
      otherNames: p.otherNames,
      lastName: p.lastName,
      email: p.email,
      telephone: p.telephone,
      address: p.address,
      occupation: p.occupation,
      dateOfBirth: p.dateOfBirth,
      photoUrl: p.photoKey ? await this.media.presignGet(p.photoKey) : null,
      homeChurch: home ?? null,
    };
  }

  /** Contact details only; names, birth date and sacraments stay with the home church (D-016). */
  async updateProfile(memberId: string, b: UpdateOwn, ip: string) {
    const clash = await this.db
      .select({ id: members.id })
      .from(members)
      .where(
        and(
          ne(members.id, memberId),
          or(
            b.email ? sql`lower(${members.email}) = ${b.email.toLowerCase()}` : undefined,
            b.telephone ? eq(members.telephone, b.telephone) : undefined,
          ),
        ),
      )
      .limit(1);
    if (clash.length)
      throw new DomainError(
        409,
        "PERSON_EXISTS",
        "That email or phone belongs to someone else on Ecclesios.",
      );
    await this.db
      .update(members)
      .set({ email: b.email, telephone: b.telephone, address: b.address, occupation: b.occupation })
      .where(eq(members.id, memberId));
    await this.audit.write({
      actorType: "MEMBER",
      actorId: memberId,
      action: "account.profile_updated",
      entityType: "member",
      entityId: memberId,
      ip,
    });
    return this.profile(memberId);
  }

  async presignPhoto(memberId: string, contentType: string, bytes: number) {
    if (!PHOTO_TYPES.includes(contentType))
      throw new DomainError(400, "UPLOAD_REJECTED", "Use a JPEG, PNG or WebP image.");
    return this.media.presignPut(
      this.media.newKey(`members/${memberId}/photo`, contentType),
      contentType,
      bytes,
    );
  }

  async setPhoto(memberId: string, key: string | null, ip: string) {
    const [p] = await this.db
      .select({ photoKey: members.photoKey })
      .from(members)
      .where(eq(members.id, memberId))
      .limit(1);
    if (key) {
      if (!key.startsWith(`members/${memberId}/photo/`))
        throw new DomainError(400, "UPLOAD_REJECTED", "That upload doesn't belong here.");
      const head = await this.media.head(key);
      if (!head?.contentType || !PHOTO_TYPES.includes(head.contentType))
        throw new DomainError(400, "UPLOAD_REJECTED", "The photo hasn't finished uploading.");
    }
    await this.db.update(members).set({ photoKey: key }).where(eq(members.id, memberId));
    if (p?.photoKey && p.photoKey !== key) await this.media.remove(p.photoKey);
    await this.audit.write({
      actorType: "MEMBER",
      actorId: memberId,
      action: key ? "account.photo_set" : "account.photo_removed",
      entityType: "member",
      entityId: memberId,
      ip,
    });
    return this.profile(memberId);
  }

  // ------------------------------------------------------------------ notifications (members and platform accounts)

  private mine(p: Principal): SQL {
    return p.kind === "member"
      ? eq(notifications.recipientMemberId, p.id)
      : eq(notifications.recipientUserId, p.id);
  }

  async unread(p: Principal, church?: string) {
    const rows = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(notifications)
      .where(
        and(
          this.mine(p),
          isNull(notifications.readAt),
          church ? eq(notifications.groupId, church) : undefined,
        ),
      );
    return rows[0]?.n ?? 0;
  }

  async list(p: Principal, q: { unread: boolean; church?: string; page: number }) {
    const rows = await this.db
      .select({
        n: notifications,
        type: notificationTypes.code,
        church: { id: groups.id, name: groups.name },
      })
      .from(notifications)
      .innerJoin(notificationTypes, eq(notificationTypes.id, notifications.typeId))
      .leftJoin(groups, eq(groups.id, notifications.groupId))
      .where(
        and(
          this.mine(p),
          q.unread ? isNull(notifications.readAt) : undefined,
          q.church ? eq(notifications.groupId, q.church) : undefined,
        ),
      )
      .orderBy(desc(notifications.createdAt))
      .limit(PAGE + 1)
      .offset((q.page - 1) * PAGE);
    // Opening the list marks everything as seen (badges count unread, not unseen).
    await this.db
      .update(notifications)
      .set({ seenAt: new Date() })
      .where(and(this.mine(p), isNull(notifications.seenAt)));
    const items: Notification[] = rows.slice(0, PAGE).map((r) => ({
      id: r.n.id,
      type: r.type,
      title: r.n.title,
      body: r.n.body,
      link: safeInternalLink(r.n.link),
      church: r.church?.id ? { id: r.church.id, name: r.church.name } : null,
      read: r.n.readAt !== null,
      createdAt: r.n.createdAt.toISOString(),
    }));
    return {
      items,
      page: q.page,
      hasMore: rows.length > PAGE,
      unread: await this.unread(p, q.church),
    };
  }

  async markRead(p: Principal, ids: string[] | "all", church?: string) {
    await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          this.mine(p),
          isNull(notifications.readAt),
          ids === "all"
            ? church
              ? eq(notifications.groupId, church)
              : undefined
            : inArray(notifications.id, ids),
        ),
      );
    return { unread: await this.unread(p, church) };
  }
}
