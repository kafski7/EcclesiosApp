import { Inject, Injectable } from "@nestjs/common";
import { teachingRelations, teachings, teachingTopicLinks, teachingTopics } from "@ecclesios/db";
import type {
  AdminTeaching,
  Teaching,
  TeachingSummary,
  TeachingTopic,
  UpsertTeachingSchema,
  UpsertTopicSchema,
} from "@ecclesios/shared";
import {
  lessonReferences,
  lessonText,
  lintLesson,
  parseLesson,
  readingMinutes,
  slugify,
  type TeachingStatus,
} from "@ecclesios/shared/domain";
import { and, asc, desc, eq, ilike, inArray, ne, or, sql } from "drizzle-orm";
import type { z } from "zod";
import { AuditService } from "../audit/audit.service";
import { DomainError } from "../auth/core/errors";
import { DB, type Database } from "../db/db.module";
import { deleteReactions } from "../engage/cleanup";
import { qcol } from "../db/qualified";

const PAGE = 20;
const RELATED_MAX = 6;
type Row = typeof teachings.$inferSelect;
type UpsertTeaching = z.output<typeof UpsertTeachingSchema>;
type UpsertTopic = z.output<typeof UpsertTopicSchema>;

const notFound = () =>
  new DomainError(404, "TEACHING_NOT_FOUND", "We couldn't find that teaching.");
const topicNotFound = (slug: string) =>
  new DomainError(400, "TOPIC_NOT_FOUND", `There is no topic "${slug}".`);
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
const ftsDoc = sql`(setweight(to_tsvector('english', ${teachings.title}), 'A') || setweight(to_tsvector('english', ${teachings.summary}), 'B') || setweight(to_tsvector('english', ${teachings.plain}), 'C'))`;

/** Teachings (functionality §3.7, D-030): public reading, search and Super-Admin authoring. */
@Injectable()
export class TeachingsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  // ------------------------------------------------------------------ helpers

  private async topicsFor(ids: string[]) {
    if (!ids.length) return new Map<string, { slug: string; name: string }[]>();
    const rows = await this.db
      .select({
        teachingId: teachingTopicLinks.teachingId,
        slug: teachingTopics.slug,
        name: teachingTopics.name,
      })
      .from(teachingTopicLinks)
      .innerJoin(teachingTopics, eq(teachingTopics.id, teachingTopicLinks.topicId))
      .where(inArray(teachingTopicLinks.teachingId, ids))
      .orderBy(asc(teachingTopicLinks.position));
    const map = new Map<string, { slug: string; name: string }[]>();
    for (const r of rows)
      map.set(r.teachingId, [...(map.get(r.teachingId) ?? []), { slug: r.slug, name: r.name }]);
    return map;
  }

  /** Public: Home (D-033) uses it for feed cards. */
  async summaries(rows: Row[]): Promise<TeachingSummary[]> {
    const topics = await this.topicsFor(rows.map((r) => r.id));
    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      summary: r.summary,
      topics: topics.get(r.id) ?? [],
      readingMinutes: r.readingMinutes,
      publishedAt: r.publishedAt?.toISOString() ?? null,
    }));
  }

  private async bySlug(slug: string, includeDrafts = false) {
    const [r] = await this.db
      .select()
      .from(teachings)
      .where(
        and(
          eq(teachings.slug, slug),
          includeDrafts ? undefined : eq(teachings.status, "PUBLISHED"),
        ),
      )
      .limit(1);
    if (!r) throw notFound();
    return r;
  }

  /** Explicit links first, then other published teachings sharing a topic. */
  private async related(row: Row, onlyPublished = true): Promise<TeachingSummary[]> {
    const explicit = await this.db
      .select({ t: teachings })
      .from(teachingRelations)
      .innerJoin(teachings, eq(teachings.id, teachingRelations.toId))
      .where(
        and(
          eq(teachingRelations.fromId, row.id),
          onlyPublished ? eq(teachings.status, "PUBLISHED") : undefined,
        ),
      )
      .orderBy(asc(teachingRelations.position));
    const picked = explicit.map((x) => x.t);
    if (picked.length < RELATED_MAX) {
      const sameTopic = await this.db
        .selectDistinct({ t: teachings })
        .from(teachingTopicLinks)
        .innerJoin(teachings, eq(teachings.id, teachingTopicLinks.teachingId))
        .where(
          and(
            inArray(
              teachingTopicLinks.topicId,
              this.db
                .select({ id: teachingTopicLinks.topicId })
                .from(teachingTopicLinks)
                .where(eq(teachingTopicLinks.teachingId, row.id)),
            ),
            ne(teachings.id, row.id),
            eq(teachings.status, "PUBLISHED"),
          ),
        )
        .limit(RELATED_MAX * 2);
      for (const x of sameTopic) if (!picked.some((p) => p.id === x.t.id)) picked.push(x.t);
    }
    return this.summaries(picked.slice(0, RELATED_MAX));
  }

  // ------------------------------------------------------------------ public

  async topics(includeEmpty = false): Promise<TeachingTopic[]> {
    const rows = await this.db
      .select({
        slug: teachingTopics.slug,
        name: teachingTopics.name,
        description: teachingTopics.description,
        teachingCount: sql<number>`(count(${teachings.id}) filter (where ${teachings.status} = 'PUBLISHED'))::int`,
      })
      .from(teachingTopics)
      .leftJoin(teachingTopicLinks, eq(teachingTopicLinks.topicId, teachingTopics.id))
      .leftJoin(teachings, eq(teachings.id, teachingTopicLinks.teachingId))
      .groupBy(teachingTopics.id)
      .orderBy(asc(teachingTopics.position), asc(teachingTopics.name));
    return includeEmpty ? rows : rows.filter((r) => r.teachingCount > 0);
  }

  async list(q: string, topic: string | undefined, page: number) {
    const term = q.trim();
    const query = sql`websearch_to_tsquery('english', ${term})`;
    let topicId: string | undefined;
    if (topic) {
      const [t] = await this.db
        .select({ id: teachingTopics.id })
        .from(teachingTopics)
        .where(eq(teachingTopics.slug, topic))
        .limit(1);
      if (!t) throw new DomainError(404, "TOPIC_NOT_FOUND", "We couldn't find that topic.");
      topicId = t.id;
    }
    const rows = await this.db
      .select()
      .from(teachings)
      .where(
        and(
          eq(teachings.status, "PUBLISHED"),
          topicId
            ? sql`exists (select 1 from ${teachingTopicLinks} l where l.teaching_id = ${qcol(teachings, teachings.id)} and l.topic_id = ${topicId})`
            : undefined,
          term
            ? or(sql`${ftsDoc} @@ ${query}`, ilike(teachings.title, `%${escapeLike(term)}%`))
            : undefined,
        ),
      )
      .orderBy(
        ...(term
          ? [desc(sql`ts_rank(${ftsDoc}, ${query})`), asc(teachings.title)]
          : [asc(teachings.title)]),
      )
      .limit(PAGE + 1)
      .offset((page - 1) * PAGE);
    return { items: await this.summaries(rows.slice(0, PAGE)), page, hasMore: rows.length > PAGE };
  }

  async detail(slug: string): Promise<Teaching> {
    const r = await this.bySlug(slug);
    const [[summary], related] = await Promise.all([this.summaries([r]), this.related(r)]);
    return { ...summary!, body: r.body, reviewedBy: r.reviewedBy, source: r.source, related };
  }

  // ------------------------------------------------------------------ Super-Admin

  async adminList(q: string) {
    const like = `%${escapeLike(q.trim())}%`;
    const rows = await this.db
      .select()
      .from(teachings)
      .where(
        q.trim() ? or(ilike(teachings.title, like), ilike(teachings.summary, like)) : undefined,
      )
      .orderBy(desc(teachings.updatedAt))
      .limit(300);
    const base = await this.summaries(rows);
    return base.map((b, i) => ({
      ...b,
      status: rows[i]!.status,
      updatedAt: rows[i]!.updatedAt.toISOString(),
    }));
  }

  private async knownSlugs() {
    const rows = await this.db.select({ slug: teachings.slug }).from(teachings);
    return new Set(rows.map((r) => r.slug));
  }

  async adminDetail(slug: string): Promise<AdminTeaching> {
    const r = await this.bySlug(slug, true);
    const [[summary], related, explicit, known] = await Promise.all([
      this.summaries([r]),
      this.related(r, false),
      this.db
        .select({ slug: teachings.slug })
        .from(teachingRelations)
        .innerJoin(teachings, eq(teachings.id, teachingRelations.toId))
        .where(eq(teachingRelations.fromId, r.id))
        .orderBy(asc(teachingRelations.position)),
      this.knownSlugs(),
    ]);
    return {
      ...summary!,
      body: r.body,
      reviewedBy: r.reviewedBy,
      source: r.source,
      related,
      status: r.status,
      relatedSlugs: explicit.map((x) => x.slug),
      problems: lintLesson(r.body, known),
    };
  }

  /** Create (slug null) or update. Teaching links written in the body join the explicit related list. */
  async upsert(
    userId: string,
    slug: string | null,
    body: UpsertTeaching,
    ip: string,
  ): Promise<AdminTeaching> {
    const blocks = parseLesson(body.body);
    const topicRows = await this.db
      .select()
      .from(teachingTopics)
      .where(inArray(teachingTopics.slug, body.topics));
    for (const t of body.topics) if (!topicRows.some((x) => x.slug === t)) throw topicNotFound(t);

    const finalSlug = slug ?? (await this.freeSlug(slugify(body.title)));
    const wanted = [...new Set([...body.related, ...lessonReferences(blocks).teachings])].filter(
      (s) => s !== finalSlug,
    );
    const targets = wanted.length
      ? await this.db
          .select({ id: teachings.id, slug: teachings.slug })
          .from(teachings)
          .where(inArray(teachings.slug, wanted))
      : [];

    await this.db.transaction(async (tx) => {
      const values = {
        title: body.title,
        summary: body.summary,
        body: body.body,
        plain: lessonText(blocks),
        readingMinutes: readingMinutes(blocks),
        reviewedBy: body.reviewedBy,
        source: body.source,
      };
      let id: string;
      if (slug) {
        const [row] = await tx
          .update(teachings)
          .set(values)
          .where(eq(teachings.slug, slug))
          .returning({ id: teachings.id });
        if (!row) throw notFound();
        id = row.id;
      } else {
        const [row] = await tx
          .insert(teachings)
          .values({ ...values, slug: finalSlug })
          .returning({ id: teachings.id });
        id = row!.id;
      }
      await tx.delete(teachingTopicLinks).where(eq(teachingTopicLinks.teachingId, id));
      await tx.insert(teachingTopicLinks).values(
        body.topics.map((t, position) => ({
          teachingId: id,
          topicId: topicRows.find((x) => x.slug === t)!.id,
          position,
        })),
      );
      await tx.delete(teachingRelations).where(eq(teachingRelations.fromId, id));
      const ordered = wanted
        .map((w) => targets.find((t) => t.slug === w))
        .filter((t): t is { id: string; slug: string } => !!t);
      if (ordered.length)
        await tx
          .insert(teachingRelations)
          .values(ordered.map((t, position) => ({ fromId: id, toId: t.id, position })));
    });
    await this.audit.write({
      actorType: "USER",
      actorId: userId,
      action: slug ? "teaching.updated" : "teaching.created",
      entityType: "teaching",
      entityId: finalSlug,
      ip,
    });
    return this.adminDetail(finalSlug);
  }

  private async freeSlug(base: string) {
    const root = base || "teaching";
    for (let i = 1; ; i++) {
      const candidate = i === 1 ? root : `${root}-${i}`;
      const [hit] = await this.db
        .select({ id: teachings.id })
        .from(teachings)
        .where(eq(teachings.slug, candidate))
        .limit(1);
      if (!hit) return candidate;
    }
  }

  /** Publishing needs a lesson with no problems (references understood, links existing). */
  async setStatus(userId: string, slug: string, status: TeachingStatus, ip: string) {
    const r = await this.bySlug(slug, true);
    if (status === "PUBLISHED") {
      const problems = lintLesson(r.body, await this.knownSlugs());
      if (problems.length)
        throw new DomainError(
          409,
          "LESSON_HAS_PROBLEMS",
          "Fix the lesson's problems before publishing.",
          { problems },
        );
    }
    await this.db
      .update(teachings)
      .set({
        status,
        ...(status === "PUBLISHED" && !r.publishedAt ? { publishedAt: new Date() } : {}),
      })
      .where(eq(teachings.id, r.id));
    await this.audit.write({
      actorType: "USER",
      actorId: userId,
      action: `teaching.${status.toLowerCase()}`,
      entityType: "teaching",
      entityId: slug,
      ip,
    });
    return this.adminDetail(slug);
  }

  async remove(userId: string, slug: string, ip: string) {
    const r = await this.bySlug(slug, true);
    await this.db.delete(teachings).where(eq(teachings.id, r.id));
    await deleteReactions(this.db, "TEACHING", r.id);
    await this.audit.write({
      actorType: "USER",
      actorId: userId,
      action: "teaching.deleted",
      entityType: "teaching",
      entityId: slug,
      ip,
    });
  }

  // topics
  async upsertTopic(slug: string | null, body: UpsertTopic) {
    if (slug) {
      const [row] = await this.db
        .update(teachingTopics)
        .set(body)
        .where(eq(teachingTopics.slug, slug))
        .returning();
      if (!row) throw new DomainError(404, "TOPIC_NOT_FOUND", "We couldn't find that topic.");
    } else {
      const base = slugify(body.name) || "topic";
      const [hit] = await this.db
        .select({ id: teachingTopics.id })
        .from(teachingTopics)
        .where(eq(teachingTopics.slug, base))
        .limit(1);
      if (hit) throw new DomainError(409, "TOPIC_EXISTS", "A topic with that name already exists.");
      await this.db.insert(teachingTopics).values({ ...body, slug: base });
    }
    return { items: await this.topics(true) };
  }

  /** Topics in use can't be deleted (move their teachings first). */
  async removeTopic(slug: string) {
    const [t] = await this.db
      .select({ id: teachingTopics.id })
      .from(teachingTopics)
      .where(eq(teachingTopics.slug, slug))
      .limit(1);
    if (!t) throw new DomainError(404, "TOPIC_NOT_FOUND", "We couldn't find that topic.");
    const [used] = await this.db
      .select({ x: teachingTopicLinks.teachingId })
      .from(teachingTopicLinks)
      .where(eq(teachingTopicLinks.topicId, t.id))
      .limit(1);
    if (used)
      throw new DomainError(
        409,
        "TOPIC_IN_USE",
        "Move this topic's teachings to another topic first.",
      );
    await this.db.delete(teachingTopics).where(eq(teachingTopics.id, t.id));
    return { items: await this.topics(true) };
  }
}
