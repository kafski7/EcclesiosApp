import { Inject, Injectable } from "@nestjs/common";
import { commentReports, members, memberships, notifications, notificationTypes, postComments, posts } from "@ecclesios/db";
import type { Comment, Principal } from "@ecclesios/shared";
import {
  canModerateComment,
  commentSegments,
  COMMENT_REPORT_THRESHOLD,
  mentionIds,
  type CommentStatus,
} from "@ecclesios/shared/domain";
import { and, asc, desc, eq, gt, ilike, inArray, ne, or, sql } from "drizzle-orm";
import { AuditService } from "../audit/audit.service";
import { RATE_LIMIT_STORE } from "../auth/auth.service";
import { DomainError } from "../auth/core/errors";
import { RateLimiter, type RateLimitStore } from "../auth/core/rate-limit";
import { DB, type Database } from "../db/db.module";
import { ExploreAccess } from "./explore-access";
import { ExploreService } from "./explore.service";

const COMMENT_LIMIT = { limit: 10, windowMs: 10 * 60_000 };
const notFound = () => new DomainError(404, "COMMENT_NOT_FOUND", "That comment no longer exists.");

/**
 * Comments on Explore posts (D-031): any signed-in member, visible at once ("post-moderation").
 * Hidden automatically after COMMENT_REPORT_THRESHOLD reports, or by the post's managers / Super-Admins.
 */
@Injectable()
export class CommentsService {
  private readonly limiter: RateLimiter;

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly explore: ExploreService,
    private readonly access: ExploreAccess,
    private readonly audit: AuditService,
    @Inject(RATE_LIMIT_STORE) store: RateLimitStore,
  ) {
    this.limiter = new RateLimiter(store);
  }

  async list(postId: string, viewer: Principal | undefined): Promise<{ items: Comment[] }> {
    const post = await this.explore.approved(postId);
    const actor = viewer ? await this.access.actor(viewer) : null;
    const moderator = actor ? canModerateComment(actor, post) : false;
    const rows = await this.db
      .select({ c: postComments, f: members.firstName, l: members.lastName })
      .from(postComments)
      .innerJoin(members, eq(members.id, postComments.memberId))
      .where(eq(postComments.postId, postId))
      .orderBy(asc(postComments.createdAt))
      .limit(500);
    const me = viewer?.kind === "member" ? viewer.id : null;
    const names = await this.names(rows.flatMap((r) => mentionIds(r.c.body)));
    return {
      items: rows
        // Hidden comments stay visible to the moderators and to the person who wrote them.
        .filter((r) => r.c.status === "VISIBLE" || moderator || r.c.memberId === me)
        .map((r) => ({
          id: r.c.id,
          author: { name: `${r.f} ${r.l}`, isMe: r.c.memberId === me },
          body: r.c.body,
          mentions: mentionIds(r.c.body)
            .filter((id) => names.has(id))
            .map((id) => ({ id, name: names.get(id)! })),
          status: r.c.status,
          createdAt: r.c.createdAt.toISOString(),
          canDelete: r.c.memberId === me,
          canModerate: moderator,
        })),
    };
  }

  /** Links are refused by the request schema (D-035); mentions must be people the writer may mention. */
  async add(memberId: string, postId: string, body: string, _ip: string) {
    const post = await this.explore.approved(postId);
    await this.limiter.consume([{ key: `comment:member:${memberId}`, ...COMMENT_LIMIT }]);
    const mentioned = mentionIds(body);
    if (mentioned.length) {
      const allowed = await this.mentionable(post, memberId, "", mentioned);
      if (allowed.length !== mentioned.length)
        throw new DomainError(400, "MENTION_NOT_ALLOWED", "You can mention people in this conversation or from your church.");
    }
    const [c] = await this.db.insert(postComments).values({ postId, memberId, body }).returning({ id: postComments.id });
    await this.notifyMentioned(post, memberId, mentioned.filter((id) => id !== memberId), c!.id);
    return this.list(postId, { kind: "member", id: memberId });
  }

  // ------------------------------------------------------------------ mentions (D-035)

  /** Full names for member ids. */
  private async names(ids: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids)];
    if (!unique.length) return new Map();
    const rows = await this.db
      .select({ id: members.id, f: members.firstName, l: members.lastName })
      .from(members)
      .where(inArray(members.id, unique));
    return new Map(rows.map((r) => [r.id, `${r.f} ${r.l}`]));
  }

  /**
   * Who a member may mention on a post: people who commented on it, the post's author, and
   * active members of the writer's own churches. Never a search of every member.
   */
  private async mentionable(post: typeof posts.$inferSelect, memberId: string, q: string, onlyIds?: string[]) {
    const myChurches = this.db
      .select({ g: memberships.groupId })
      .from(memberships)
      .where(and(eq(memberships.memberId, memberId), eq(memberships.status, "ACTIVE")));
    const commenters = this.db.selectDistinct({ id: postComments.memberId }).from(postComments).where(eq(postComments.postId, post.id));
    const churchFolk = this.db
      .selectDistinct({ id: memberships.memberId })
      .from(memberships)
      .where(and(eq(memberships.status, "ACTIVE"), inArray(memberships.groupId, myChurches)));
    const term = q.trim().replace(/[\\%_]/g, (c) => `\\${c}`);
    const rows = await this.db
      .select({
        id: members.id,
        f: members.firstName,
        l: members.lastName,
        inThread: sql<boolean>`(${members.id} in (select pc.member_id from ${postComments} pc where pc.post_id = ${post.id}) or ${members.id} = ${post.authorMemberId ?? null})`,
      })
      .from(members)
      .where(
        and(
          ne(members.id, memberId),
          eq(members.isActive, true),
          or(inArray(members.id, commenters), inArray(members.id, churchFolk), post.authorMemberId ? eq(members.id, post.authorMemberId) : undefined),
          onlyIds ? inArray(members.id, onlyIds) : undefined,
          term ? or(ilike(members.firstName, `${term}%`), ilike(members.lastName, `${term}%`), ilike(sql`${members.firstName} || ' ' || ${members.lastName}`, `${term}%`)) : undefined,
        ),
      )
      .orderBy(asc(members.firstName), asc(members.lastName))
      .limit(onlyIds ? onlyIds.length : 8);
    return rows;
  }

  async suggestions(memberId: string, postId: string, q: string) {
    const post = await this.explore.approved(postId);
    const rows = await this.mentionable(post, memberId, q);
    return {
      items: rows
        .sort((a, b) => Number(b.inThread) - Number(a.inThread))
        .map((r) => ({ id: r.id, name: `${r.f} ${r.l}`, hint: r.inThread ? "In this conversation" : "From your church" })),
    };
  }

  private async notifyMentioned(post: typeof posts.$inferSelect, writerId: string, ids: string[], commentId: string) {
    if (!ids.length) return;
    try {
      const [type] = await this.db.select({ id: notificationTypes.id }).from(notificationTypes).where(eq(notificationTypes.code, "COMMENT_MENTION")).limit(1);
      if (!type) return;
      const writer = (await this.names([writerId])).get(writerId) ?? "Someone";
      await this.db.insert(notifications).values(
        ids.map((id) => ({
          typeId: type.id,
          recipientMemberId: id,
          title: `${writer} mentioned you on "${post.title}"`.slice(0, 200),
          link: `/explore/posts/${post.id}#c-${commentId}`,
        })),
      );
    } catch {
      /* a failed notification must not undo the comment */
    }
  }

  private async comment(id: string) {
    const [row] = await this.db
      .select({ c: postComments, post: posts })
      .from(postComments)
      .innerJoin(posts, eq(posts.id, postComments.postId))
      .where(eq(postComments.id, id))
      .limit(1);
    if (!row) throw notFound();
    return row;
  }

  async remove(memberId: string, id: string) {
    const { c } = await this.comment(id);
    if (c.memberId !== memberId) throw new DomainError(403, "NOT_ALLOWED", "You can only delete your own comments.");
    await this.db.delete(postComments).where(eq(postComments.id, id));
  }

  /** One report per person; the comment hides itself at the threshold until reviewed. */
  async report(memberId: string, id: string, ip: string) {
    const { c } = await this.comment(id);
    if (c.memberId === memberId) return;
    const added = await this.db.insert(commentReports).values({ commentId: id, memberId }).onConflictDoNothing().returning();
    if (!added.length) return;
    const [next] = await this.db
      .update(postComments)
      .set({
        reportCount: sql`${postComments.reportCount} + 1`,
        status: sql`case when ${postComments.reportCount} + 1 >= ${COMMENT_REPORT_THRESHOLD} then 'HIDDEN'::comment_status_enum else ${postComments.status} end`,
      })
      .where(eq(postComments.id, id))
      .returning();
    if (next?.status === "HIDDEN" && c.status === "VISIBLE")
      await this.audit.write({ actorType: "SYSTEM", action: "explore.comment_auto_hidden", entityType: "comment", entityId: id, metadata: { reports: next.reportCount }, ip });
  }

  async setStatus(p: Principal, id: string, status: CommentStatus, ip: string) {
    const { c, post } = await this.comment(id);
    const actor = await this.access.actor(p);
    if (!canModerateComment(actor, post)) throw new DomainError(403, "NOT_ALLOWED", "Only the post's managers can hide comments.");
    // Restoring clears the reports, so the same reports can't hide it again.
    await this.db.update(postComments).set({ status, ...(status === "VISIBLE" ? { reportCount: 0 } : {}) }).where(eq(postComments.id, id));
    if (status === "VISIBLE") await this.db.delete(commentReports).where(eq(commentReports.commentId, id));
    await this.audit.write({
      actorType: actor.kind === "user" ? "USER" : "MEMBER",
      actorId: actor.id,
      groupId: post.churchId,
      action: status === "HIDDEN" ? "explore.comment_hidden" : "explore.comment_restored",
      entityType: "comment",
      entityId: c.id,
      ip,
    });
  }

  /** Super-Admin: comments with reports, most reported first. */
  async reported() {
    const rows = await this.db
      .select({ c: postComments, f: members.firstName, l: members.lastName, title: posts.title })
      .from(postComments)
      .innerJoin(members, eq(members.id, postComments.memberId))
      .innerJoin(posts, eq(posts.id, postComments.postId))
      .where(gt(postComments.reportCount, 0))
      .orderBy(desc(postComments.reportCount), desc(postComments.createdAt))
      .limit(200);
    const names = await this.names(rows.flatMap((r) => mentionIds(r.c.body)));
    return {
      items: rows.map((r) => ({
        id: r.c.id,
        // The console shows names, not mention tokens.
        body: commentSegments(r.c.body, names).map((x) => (x.t === "mention" ? `@${x.name}` : x.v)).join(""),
        status: r.c.status,
        author: `${r.f} ${r.l}`,
        reports: r.c.reportCount,
        post: { id: r.c.postId, title: r.title },
        createdAt: r.c.createdAt.toISOString(),
      })),
    };
  }
}

