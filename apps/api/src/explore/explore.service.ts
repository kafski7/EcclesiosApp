import { Inject, Injectable, Logger } from "@nestjs/common";
import { follows, groups, members, notificationTypes, notifications, posts, users } from "@ecclesios/db";
import type { MyPost, Post, PostAuthor, PostDecision, PostSummary, Principal, UpsertPostSchema } from "@ecclesios/shared";
import {
  canManagePost,
  canPostAsChurch,
  canPostAsSelf,
  InvalidPostTransition,
  nextPostStatus,
  postProblems,
  submitSkipsQueue,
  youTubeId,
  type PostAction,
  type PostKind,
} from "@ecclesios/shared/domain";
import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import type { z } from "zod";
import { AuditService } from "../audit/audit.service";
import { DomainError } from "../auth/core/errors";
import { DB, type Database } from "../db/db.module";
import { deleteReactions } from "../engage/cleanup";
import { MediaService } from "../media/media.service";
import { ExploreAccess, type Actor } from "./explore-access";

type Row = typeof posts.$inferSelect;
type UpsertPost = z.output<typeof UpsertPostSchema>;
const PAGE = 20;
const COVER_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const postNotFound = () => new DomainError(404, "POST_NOT_FOUND", "We couldn't find that post.");
const notAllowed = (m = "You can't change this post.") => new DomainError(403, "NOT_ALLOWED", m);
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Explore posts (functionality §3.4, D-031): public reading, authoring and moderation. */
@Injectable()
export class ExploreService {
  private readonly logger = new Logger(ExploreService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly access: ExploreAccess,
    private readonly media: MediaService,
    private readonly audit: AuditService,
  ) {}

  // ------------------------------------------------------------------ mapping

  async authors(rows: Row[]): Promise<(r: Row) => PostAuthor> {
    const churchIds = [...new Set(rows.map((r) => r.churchId).filter((x): x is string => !!x))];
    const memberIds = [...new Set(rows.filter((r) => !r.churchId && r.authorMemberId).map((r) => r.authorMemberId!))];
    const userIds = [...new Set(rows.filter((r) => !r.churchId && r.authorUserId).map((r) => r.authorUserId!))];
    const [c, m, u] = await Promise.all([
      churchIds.length ? this.db.select({ id: groups.id, name: groups.name, level: groups.level }).from(groups).where(inArray(groups.id, churchIds)) : [],
      memberIds.length ? this.db.select({ id: members.id, f: members.firstName, l: members.lastName }).from(members).where(inArray(members.id, memberIds)) : [],
      userIds.length ? this.db.select({ id: users.id, name: users.fullName, role: users.platformRole }).from(users).where(inArray(users.id, userIds)) : [],
    ]);
    return (r) => {
      if (r.churchId) {
        const g = c.find((x) => x.id === r.churchId);
        return { kind: "CHURCH", id: r.churchId, name: g?.name ?? "Church", level: g?.level ?? "PARISH" };
      }
      if (r.authorMemberId) {
        const p = m.find((x) => x.id === r.authorMemberId);
        return { kind: "PERSON", name: p ? `${p.f} ${p.l}` : "Member" };
      }
      const p = u.find((x) => x.id === r.authorUserId);
      return p?.role === "SUPER_ADMIN" ? { kind: "PLATFORM", name: "Ecclesios" } : { kind: "PERSON", name: p?.name ?? "Creator" };
    };
  }

  private async commentCounts(ids: string[]) {
    if (!ids.length) return new Map<string, number>();
    const rows = await this.db.execute<{ post_id: string; n: number }>(sql`
      select post_id, count(*)::int as n from post_comments
      where status = 'VISIBLE' and post_id in (${sql.join(ids.map((i) => sql`${i}::uuid`), sql`, `)})
      group by post_id`);
    return new Map((rows as unknown as { post_id: string; n: number }[]).map((r) => [r.post_id, r.n]));
  }

  async summaries(rows: Row[]): Promise<PostSummary[]> {
    const [author, counts] = await Promise.all([this.authors(rows), this.commentCounts(rows.map((r) => r.id))]);
    return Promise.all(rows.map(async (r) => this.summary(r, author(r), counts.get(r.id) ?? 0)));
  }

  private async summary(r: Row, author: PostAuthor, commentCount: number): Promise<PostSummary> {
    return {
      id: r.id,
      kind: r.kind,
      title: r.title,
      summary: r.summary,
      author,
      coverUrl: r.coverKey ? await this.media.presignGet(r.coverKey) : null,
      youtubeId: r.youtubeId,
      event:
        r.kind === "EVENT" && r.startsAt
          ? { startsAt: r.startsAt.toISOString(), endsAt: r.endsAt?.toISOString() ?? null, place: r.place ?? "", onlineUrl: r.onlineUrl }
          : null,
      publishedAt: r.publishedAt?.toISOString() ?? null,
      commentCount,
    };
  }

  async mine(r: Row): Promise<MyPost> {
    const [s] = await this.summaries([r]);
    return {
      ...s!,
      body: r.body,
      status: r.status,
      reviewNote: r.reviewNote,
      churchId: r.churchId,
      youtube: r.youtubeId ? `https://youtu.be/${r.youtubeId}` : null,
      problems: postProblems(r.kind, r.body, r),
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  // ------------------------------------------------------------------ public reading

  async list(
    q: { kind?: PostKind; church?: string; following?: "1"; past?: "1"; q: string; page: number },
    viewer: Principal | undefined,
  ) {
    const now = new Date();
    const where: (SQL | undefined)[] = [eq(posts.status, "APPROVED")];
    if (q.kind) where.push(eq(posts.kind, q.kind));
    if (q.church) where.push(eq(posts.churchId, q.church));
    if (q.following) {
      if (viewer?.kind !== "member") return { items: [], page: q.page, hasMore: false };
      where.push(inArray(posts.churchId, this.db.select({ id: follows.groupId }).from(follows).where(eq(follows.memberId, viewer.id))));
    }
    const term = q.q.trim();
    if (term)
      where.push(
        or(
          ilike(posts.title, `%${escapeLike(term)}%`),
          sql`to_tsvector('english', ${posts.title} || ' ' || ${posts.summary} || ' ' || ${posts.body}) @@ websearch_to_tsquery('english', ${term})`,
        ),
      );
    let order: SQL[] = [desc(posts.publishedAt)];
    if (q.kind === "EVENT") {
      // Upcoming: still running or starting later. Past: already over.
      // Pass the time as text with an explicit cast: drizzle doesn't convert a Date
      // compared against an expression (only against a column), so a raw Date breaks the driver.
      const over = sql`coalesce(${posts.endsAt}, ${posts.startsAt})`;
      const at = sql`${now.toISOString()}::timestamptz`;
      where.push(q.past ? sql`${over} < ${at}` : sql`${over} >= ${at}`);
      order = q.past ? [desc(posts.startsAt)] : [asc(posts.startsAt)];
    }
    const rows = await this.db
      .select()
      .from(posts)
      .where(and(...where))
      .orderBy(...order)
      .limit(PAGE + 1)
      .offset((q.page - 1) * PAGE);
    return { items: await this.summaries(rows.slice(0, PAGE)), page: q.page, hasMore: rows.length > PAGE };
  }

  async detail(id: string): Promise<Post> {
    const [r] = await this.db.select().from(posts).where(and(eq(posts.id, id), eq(posts.status, "APPROVED"))).limit(1);
    if (!r) throw postNotFound();
    const [s] = await this.summaries([r]);
    return { ...s!, body: r.body };
  }

  async approved(id: string) {
    const [r] = await this.db.select().from(posts).where(and(eq(posts.id, id), eq(posts.status, "APPROVED"))).limit(1);
    if (!r) throw postNotFound();
    return r;
  }

  // ------------------------------------------------------------------ authoring

  async options(p: Principal) {
    const actor = await this.access.actor(p);
    return {
      asSelf: canPostAsSelf(actor),
      churches: actor.kind === "member" ? await this.access.administeredChurches(actor.id) : [],
    };
  }

  async myPosts(p: Principal) {
    const actor = await this.access.actor(p);
    const churchIds = actor.kind === "member" ? (await this.access.administeredChurches(actor.id)).map((c) => c.id) : [];
    const mineOnly = actor.kind === "user" ? eq(posts.authorUserId, actor.id) : eq(posts.authorMemberId, actor.id);
    const rows = await this.db
      .select()
      .from(posts)
      .where(churchIds.length ? or(and(mineOnly, sql`${posts.churchId} is null`), inArray(posts.churchId, churchIds)) : and(mineOnly, sql`${posts.churchId} is null`))
      .orderBy(desc(posts.updatedAt))
      .limit(200);
    return { items: await Promise.all(rows.map((r) => this.mine(r))) };
  }

  private async managed(p: Principal, id: string) {
    const [actor, [row]] = await Promise.all([this.access.actor(p), this.db.select().from(posts).where(eq(posts.id, id)).limit(1)]);
    if (!row || !canManagePost(actor, row)) throw postNotFound(); // don't reveal other people's drafts
    return { actor, row };
  }

  async myPost(p: Principal, id: string) {
    return this.mine((await this.managed(p, id)).row);
  }

  private values(b: UpsertPost) {
    const yt = b.youtube ? youTubeId(b.youtube) : null;
    if (b.youtube && !yt) throw new DomainError(400, "VALIDATION_FAILED", "That doesn't look like a YouTube link.");
    const event = b.kind === "EVENT";
    return {
      kind: b.kind,
      title: b.title,
      summary: b.summary,
      body: b.body,
      youtubeId: yt,
      startsAt: event && b.startsAt ? new Date(b.startsAt) : null,
      endsAt: event && b.endsAt ? new Date(b.endsAt) : null,
      place: event ? b.place : null,
      onlineUrl: event ? b.onlineUrl : null,
    };
  }

  async create(p: Principal, b: UpsertPost, ip: string) {
    const actor = await this.access.actor(p);
    if (b.churchId ? !canPostAsChurch(actor, b.churchId) : !canPostAsSelf(actor))
      throw notAllowed(
        b.churchId
          ? "Only this church's Administrator can post in its name."
          : "Posting on Explore needs approval as a content creator.",
      );
    const [row] = await this.db
      .insert(posts)
      .values({
        ...this.values(b),
        churchId: b.churchId,
        authorUserId: actor.kind === "user" ? actor.id : null,
        authorMemberId: actor.kind === "member" ? actor.id : null,
      })
      .returning();
    await this.log(actor, "explore.post_created", row!.id, ip, b.churchId);
    return this.mine(row!);
  }

  /** Any edit sends the post back to DRAFT; it must be submitted (and reviewed) again (D-031). */
  async update(p: Principal, id: string, b: UpsertPost, ip: string) {
    const { actor, row } = await this.managed(p, id);
    const status = this.transition(row.status, "edit");
    const [next] = await this.db
      .update(posts)
      .set({ ...this.values(b), status, publishedAt: status === "DRAFT" ? null : row.publishedAt })
      .where(eq(posts.id, id))
      .returning();
    await this.log(actor, "explore.post_edited", id, ip, row.churchId, { was: row.status });
    return this.mine(next!);
  }

  async submit(p: Principal, id: string, ip: string) {
    const { actor, row } = await this.managed(p, id);
    const problems = postProblems(row.kind, row.body, row);
    if (problems.length) throw new DomainError(409, "POST_INCOMPLETE", problems[0]!, { problems });
    const now = new Date();
    const status = this.transition(row.status, "submit");
    const direct = submitSkipsQueue(actor);
    const [next] = await this.db
      .update(posts)
      .set(
        direct
          ? { status: "APPROVED", submittedAt: now, publishedAt: now, reviewedByUserId: actor.id, reviewNote: null }
          : { status, submittedAt: now, reviewNote: null },
      )
      .where(eq(posts.id, id))
      .returning();
    await this.log(actor, direct ? "explore.post_published" : "explore.post_submitted", id, ip, row.churchId);
    if (direct) await this.notifyFollowers(next!);
    return this.mine(next!);
  }

  async remove(p: Principal, id: string, ip: string) {
    const { actor, row } = await this.managed(p, id);
    await this.db.delete(posts).where(eq(posts.id, id));
    await deleteReactions(this.db, "POST", id);
    if (row.coverKey) await this.media.remove(row.coverKey);
    await this.log(actor, "explore.post_deleted", id, ip, row.churchId, { title: row.title });
  }

  async presignCover(p: Principal, id: string, contentType: string, bytes: number) {
    const { row } = await this.managed(p, id);
    if (!COVER_TYPES.includes(contentType)) throw new DomainError(400, "UPLOAD_REJECTED", "Use a JPEG, PNG or WebP image.");
    return this.media.presignPut(this.media.newKey(`explore/${row.id}`, contentType), contentType, bytes);
  }

  async setCover(p: Principal, id: string, key: string | null) {
    const { row } = await this.managed(p, id);
    if (key) {
      if (!key.startsWith(`explore/${row.id}/`)) throw new DomainError(400, "UPLOAD_REJECTED", "That upload doesn't belong here.");
      const head = await this.media.head(key);
      if (!head?.contentType || !COVER_TYPES.includes(head.contentType)) {
        if (head) await this.media.remove(key);
        throw new DomainError(400, "UPLOAD_REJECTED", "The image hasn't finished uploading or isn't a supported type.");
      }
    }
    // A new picture is a change like any other: an approved post goes back for review.
    const status = row.status === "DRAFT" ? "DRAFT" : this.transition(row.status, "edit");
    const [next] = await this.db.update(posts).set({ coverKey: key, status, publishedAt: status === "DRAFT" ? null : row.publishedAt }).where(eq(posts.id, id)).returning();
    if (row.coverKey && row.coverKey !== key) await this.media.remove(row.coverKey);
    return this.mine(next!);
  }

  private transition(from: Row["status"], action: PostAction) {
    try {
      return nextPostStatus(from, action);
    } catch (e) {
      if (e instanceof InvalidPostTransition) throw new DomainError(409, "INVALID_TRANSITION", e.message);
      throw e;
    }
  }

  // ------------------------------------------------------------------ moderation (Super-Admin)

  async queue() {
    const rows = await this.db.select().from(posts).where(eq(posts.status, "PENDING")).orderBy(asc(posts.submittedAt));
    const author = await this.authors(rows);
    const people = await this.submitters(rows);
    return {
      items: await Promise.all(
        rows.map(async (r) => ({
          ...(await this.mine(r)),
          submittedBy: people(r) + (r.churchId ? ` for ${author(r).name}` : ""),
          submittedAt: r.submittedAt?.toISOString() ?? null,
        })),
      ),
    };
  }

  /** The person behind a post, even when it is in a church's name. */
  private async submitters(rows: Row[]) {
    const ids = [...new Set(rows.map((r) => r.authorMemberId).filter((x): x is string => !!x))];
    const uids = [...new Set(rows.map((r) => r.authorUserId).filter((x): x is string => !!x))];
    const [m, u] = await Promise.all([
      ids.length ? this.db.select({ id: members.id, f: members.firstName, l: members.lastName }).from(members).where(inArray(members.id, ids)) : [],
      uids.length ? this.db.select({ id: users.id, name: users.fullName }).from(users).where(inArray(users.id, uids)) : [],
    ]);
    return (r: Row) => {
      const x = m.find((y) => y.id === r.authorMemberId);
      return x ? `${x.f} ${x.l}` : (u.find((y) => y.id === r.authorUserId)?.name ?? "Unknown");
    };
  }

  async decide(userId: string, id: string, d: PostDecision, ip: string) {
    const [row] = await this.db.select().from(posts).where(eq(posts.id, id)).limit(1);
    if (!row) throw postNotFound();
    const status = this.transition(row.status, d.decision);
    const now = new Date();
    const [next] = await this.db
      .update(posts)
      .set({
        status,
        reviewedByUserId: userId,
        reviewNote: d.note ?? null,
        ...(status === "APPROVED" ? { publishedAt: now } : {}),
      })
      .where(eq(posts.id, id))
      .returning();
    await this.audit.write({
      actorType: "USER",
      actorId: userId,
      groupId: row.churchId,
      action: `explore.post_${d.decision === "approve" ? "approved" : d.decision === "reject" ? "rejected" : "removed"}`,
      entityType: "post",
      entityId: id,
      metadata: { note: d.note ?? null, title: row.title },
      ip,
    });
    const verdict = { approve: "is now live on Explore", reject: "was not approved", remove: "was taken down" }[d.decision];
    await this.notifyAuthor(row, `"${row.title}" ${verdict}`, d.note ?? null);
    if (status === "APPROVED") await this.notifyFollowers(next!);
    return this.mine(next!);
  }

  // ------------------------------------------------------------------ notifications

  private async type(code: string) {
    const [t] = await this.db.select({ id: notificationTypes.id }).from(notificationTypes).where(eq(notificationTypes.code, code)).limit(1);
    return t?.id;
  }

  private async notifyAuthor(row: Row, title: string, body: string | null) {
    try {
      const typeId = await this.type("EXPLORE_REVIEW");
      if (!typeId) return;
      await this.db.insert(notifications).values({
        typeId,
        groupId: row.churchId,
        recipientMemberId: row.authorMemberId,
        recipientUserId: row.authorMemberId ? null : row.authorUserId,
        title: title.slice(0, 200),
        body,
        link: `/explore/write/${row.id}`,
      });
    } catch (err) {
      this.logger.error({ err, post: row.id }, "could not notify the author");
    }
  }

  /** Followers of the church hear about its new post once (first approval). Phase 7 moves this to a worker. */
  private async notifyFollowers(row: Row) {
    if (!row.churchId) return;
    try {
      const already = await this.db.execute(sql`
        select 1 from notifications n join notification_types t on t.id = n.type_id
        where t.code = 'CHURCH_POST' and n.link = ${`/explore/posts/${row.id}`} limit 1`);
      if ((already as unknown as unknown[]).length) return;
      const typeId = await this.type("CHURCH_POST");
      if (!typeId) return;
      const [g] = await this.db.select({ name: groups.name }).from(groups).where(eq(groups.id, row.churchId));
      const title = `${g?.name ?? "A church"}: ${row.title}`.slice(0, 200);
      await this.db.execute(sql`
        insert into notifications (type_id, group_id, recipient_member_id, title, link)
        select ${typeId}, ${row.churchId}, ${follows.memberId}, ${title}, ${`/explore/posts/${row.id}`}
        from ${follows} where ${follows.groupId} = ${row.churchId}
          and ${follows.memberId} is distinct from ${row.authorMemberId}`);
    } catch (err) {
      this.logger.error({ err, post: row.id }, "could not notify followers");
    }
  }

  private log(actor: Actor, action: string, id: string, ip: string, churchId: string | null, metadata: Record<string, unknown> = {}) {
    return this.audit.write({
      actorType: actor.kind === "user" ? "USER" : "MEMBER",
      actorId: actor.id,
      groupId: churchId,
      action,
      entityType: "post",
      entityId: id,
      metadata,
      ip,
    });
  }
}

