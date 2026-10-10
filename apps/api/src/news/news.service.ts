import { Inject, Injectable } from "@nestjs/common";
import { news } from "@ecclesios/db";
import type { AdminNews, NewsItem, NewsSummary, UpsertNewsSchema } from "@ecclesios/shared";
import {
  isNewsCurrent,
  lintLesson,
  orderNews,
  slugify,
  type NewsCategory,
  type NewsStatus,
} from "@ecclesios/shared/domain";
import { and, desc, eq, gt, isNull, lte, or } from "drizzle-orm";
import type { z } from "zod";
import { AuditService } from "../audit/audit.service";
import { DomainError } from "../auth/core/errors";
import { DB, type Database } from "../db/db.module";
import { MediaService } from "../media/media.service";

const PAGE = 20;
type Row = typeof news.$inferSelect;
type Upsert = z.output<typeof UpsertNewsSchema>;
const notFound = () => new DomainError(404, "NEWS_NOT_FOUND", "We couldn't find that news item.");

/** Platform news (D-032): official Ecclesios announcements. */
@Injectable()
export class NewsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly media: MediaService,
    private readonly audit: AuditService,
  ) {}

  private live(now: Date) {
    return and(eq(news.status, "PUBLISHED"), lte(news.publishedAt, now));
  }

  async summary(r: Row): Promise<NewsSummary> {
    return {
      slug: r.slug,
      title: r.title,
      summary: r.summary,
      category: r.category,
      pinned: r.pinned,
      coverUrl: r.coverKey ? await this.media.presignGet(r.coverKey) : null,
      publishedAt: (r.publishedAt ?? r.createdAt).toISOString(),
    };
  }

  /** Public list: every live item, pinned first, newest first (expired items stay readable here). */
  async list(category: NewsCategory | undefined, page: number, now = new Date()) {
    const rows = await this.db
      .select()
      .from(news)
      .where(and(this.live(now), category ? eq(news.category, category) : undefined))
      .orderBy(desc(news.pinned), desc(news.publishedAt))
      .limit(PAGE + 1)
      .offset((page - 1) * PAGE);
    return {
      items: await Promise.all(rows.slice(0, PAGE).map((r) => this.summary(r))),
      page,
      hasMore: rows.length > PAGE,
    };
  }

  /** For Home: current (live, not expired) items, pinned first. */
  async current(limit: number, now = new Date()): Promise<NewsSummary[]> {
    const rows = await this.db
      .select()
      .from(news)
      .where(and(this.live(now), or(isNull(news.expiresAt), gt(news.expiresAt, now))))
      .orderBy(desc(news.pinned), desc(news.publishedAt))
      .limit(limit);
    return Promise.all(
      orderNews(rows.filter((r) => isNewsCurrent(r, now))).map((r) => this.summary(r)),
    );
  }

  /** For the Home feed: current items newest first (not pinned-first), up to `limit`. */
  async recentRows(limit: number, now = new Date()) {
    return this.db
      .select()
      .from(news)
      .where(and(this.live(now), or(isNull(news.expiresAt), gt(news.expiresAt, now))))
      .orderBy(desc(news.publishedAt))
      .limit(limit);
  }

  async detail(slug: string, now = new Date()): Promise<NewsItem> {
    const [r] = await this.db
      .select()
      .from(news)
      .where(and(eq(news.slug, slug), this.live(now)))
      .limit(1);
    if (!r) throw notFound();
    return this.item(r);
  }

  private async item(r: Row): Promise<NewsItem> {
    return {
      ...(await this.summary(r)),
      body: r.body,
      link: r.linkUrl ? { url: r.linkUrl, label: r.linkLabel || "Learn more" } : null,
    };
  }

  // ------------------------------------------------------------------ Super-Admin

  private state(r: Row, now = new Date()): AdminNews["state"] {
    if (r.status === "DRAFT") return "DRAFT";
    if (r.publishedAt && r.publishedAt > now) return "SCHEDULED";
    if (r.expiresAt && r.expiresAt <= now) return "EXPIRED";
    return "LIVE";
  }

  private async admin(r: Row): Promise<AdminNews> {
    return {
      ...(await this.item(r)),
      publishedAt: r.publishedAt?.toISOString() ?? null,
      status: r.status,
      expiresAt: r.expiresAt?.toISOString() ?? null,
      state: this.state(r),
      problems: r.body.trim() ? lintLesson(r.body) : [],
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  private async bySlug(slug: string) {
    const [r] = await this.db.select().from(news).where(eq(news.slug, slug)).limit(1);
    if (!r) throw notFound();
    return r;
  }

  async adminList() {
    const rows = await this.db.select().from(news).orderBy(desc(news.updatedAt)).limit(300);
    return Promise.all(
      rows.map(async (r) => {
        const full = await this.admin(r);
        const rest = { ...full };
        delete (rest as { body?: string }).body;
        delete (rest as { problems?: string[] }).problems;
        return rest;
      }),
    );
  }

  adminDetail = async (slug: string) => this.admin(await this.bySlug(slug));

  async upsert(userId: string, slug: string | null, b: Upsert, ip: string) {
    const values = {
      title: b.title,
      summary: b.summary,
      body: b.body,
      category: b.category,
      pinned: b.pinned,
      linkUrl: b.linkUrl,
      linkLabel: b.linkUrl ? b.linkLabel : null,
      expiresAt: b.expiresAt ? new Date(b.expiresAt) : null,
    };
    let row: Row;
    if (slug) {
      const cur = await this.bySlug(slug);
      // A scheduled or live item can be moved in time; a draft keeps no publish time.
      const publishedAt =
        cur.status === "PUBLISHED" && b.publishAt ? new Date(b.publishAt) : cur.publishedAt;
      [row] = (await this.db
        .update(news)
        .set({ ...values, publishedAt })
        .where(eq(news.id, cur.id))
        .returning()) as [Row];
    } else {
      const s = await this.freeSlug(slugify(b.title));
      // New items are drafts; the publish time is chosen when publishing (setStatus).
      [row] = (await this.db
        .insert(news)
        .values({ ...values, slug: s, authorUserId: userId, publishedAt: null })
        .returning()) as [Row];
    }
    await this.audit.write({
      actorType: "USER",
      actorId: userId,
      action: slug ? "news.updated" : "news.created",
      entityType: "news",
      entityId: row.slug,
      ip,
    });
    return this.admin(row);
  }

  private async freeSlug(base: string) {
    const root = base || "news";
    for (let i = 1; ; i++) {
      const candidate = i === 1 ? root : `${root}-${i}`;
      const [hit] = await this.db
        .select({ id: news.id })
        .from(news)
        .where(eq(news.slug, candidate))
        .limit(1);
      if (!hit) return candidate;
    }
  }

  /** Publish now (or at `publishAt`), or take back to draft. Body problems block publishing. */
  async setStatus(
    userId: string,
    slug: string,
    status: NewsStatus,
    publishAt: string | null,
    ip: string,
  ) {
    const r = await this.bySlug(slug);
    if (status === "PUBLISHED") {
      const problems = r.body.trim() ? lintLesson(r.body) : [];
      if (problems.length)
        throw new DomainError(
          409,
          "NEWS_HAS_PROBLEMS",
          "Fix the text's problems before publishing.",
          { problems },
        );
    }
    const publishedAt = status === "DRAFT" ? null : publishAt ? new Date(publishAt) : new Date();
    const [row] = await this.db
      .update(news)
      .set({ status, publishedAt })
      .where(eq(news.id, r.id))
      .returning();
    await this.audit.write({
      actorType: "USER",
      actorId: userId,
      action: `news.${status.toLowerCase()}`,
      entityType: "news",
      entityId: slug,
      ip,
      metadata: { publishAt },
    });
    return this.admin(row!);
  }

  async remove(userId: string, slug: string, ip: string) {
    const r = await this.bySlug(slug);
    await this.db.delete(news).where(eq(news.id, r.id));
    if (r.coverKey) await this.media.remove(r.coverKey);
    await this.audit.write({
      actorType: "USER",
      actorId: userId,
      action: "news.deleted",
      entityType: "news",
      entityId: slug,
      ip,
    });
  }
}
