import { Inject, Injectable } from "@nestjs/common";
import { hymnBooks, hymnMedia, hymnNumbers, hymns, hymnTags, hymnTunes } from "@ecclesios/db";
import type {
  AddMediaSchema,
  AdminHymn,
  Hymn,
  HymnBook,
  HymnMedia,
  HymnSummary,
  UpdateMediaSchema,
  UpsertHymnSchema,
  UpsertTuneSchema,
} from "@ecclesios/shared";
import {
  canOpenMedia,
  defaultMediaAccess,
  hymnDisplayTitle,
  hymnNumberKey,
  MAX_UPLOAD_BYTES,
  MEDIA_CONTENT_TYPES,
  normalizeHymnNumber,
  orderBookNumbers,
  parseHymnQuery,
  slugify,
  youTubeId,
  type MediaViewer,
} from "@ecclesios/shared/domain";
import { and, asc, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import type { z } from "zod";
import { AuditService } from "../audit/audit.service";
import { DomainError } from "../auth/core/errors";
import { ENV, type Env } from "../config/env";
import { DB, type Database } from "../db/db.module";
import { MediaService } from "../media/media.service";

const PAGE = 30;
const notFound = (code: string, what: string) => new DomainError(404, code, `We couldn't find that ${what}.`);
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

type MediaRow = typeof hymnMedia.$inferSelect;
type Upload = Extract<z.output<typeof AddMediaSchema>, { key: string }>;

/** Hymnal (functionality §3.6, D-026). */
@Injectable()
export class HymnalService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: Env,
    private readonly media: MediaService,
    private readonly audit: AuditService,
  ) {}

  private get paywall() {
    return this.env.HYMNAL_PAYWALL;
  }

  // ------------------------------------------------------------------ books

  async books(): Promise<HymnBook[]> {
    const rows = await this.db
      .select({
        code: hymnBooks.code,
        name: hymnBooks.name,
        country: hymnBooks.country,
        publisher: hymnBooks.publisher,
        hymnCount: sql<number>`(select count(*)::int from ${hymnNumbers} where ${hymnNumbers.bookId} = ${hymnBooks.id})`,
      })
      .from(hymnBooks)
      .where(eq(hymnBooks.isActive, true))
      .orderBy(asc(hymnBooks.country), asc(hymnBooks.sortOrder));
    return rows;
  }

  /** Lower-case aliases → code: the code itself and each word of the name ("new", "catholic"…) is too vague, so code only plus "<code> hymnal". */
  private async bookAliases() {
    const rows = await this.db.select({ id: hymnBooks.id, code: hymnBooks.code }).from(hymnBooks);
    const aliases: Record<string, string> = {};
    for (const r of rows) aliases[r.code.toLowerCase()] = r.code;
    return { aliases, idOf: new Map(rows.map((r) => [r.code, r.id])) };
  }

  // ------------------------------------------------------------------ search

  async search(q: string, opts: { book?: string; tag?: string; country?: string; page: number }) {
    const { aliases, idOf } = await this.bookAliases();
    const parsed = parseHymnQuery(q, aliases);
    const bookCode = parsed.book ?? opts.book ?? null;
    const bookId = bookCode ? idOf.get(bookCode) : undefined;
    if (bookCode && !bookId) throw notFound("BOOK_NOT_FOUND", "hymn book");
    const offset = (opts.page - 1) * PAGE;

    const conditions = [eq(hymns.isPublished, true)];
    if (opts.tag) conditions.push(sql`exists (select 1 from ${hymnTags} where ${hymnTags.hymnId} = ${hymns.id} and ${hymnTags.tag} = ${opts.tag.toLowerCase()})`);

    let ids: string[];
    if (parsed.number) {
      const rows = await this.db
        .select({ id: hymnNumbers.hymnId })
        .from(hymnNumbers)
        .innerJoin(hymns, eq(hymns.id, hymnNumbers.hymnId))
        .where(and(eq(hymnNumbers.number, parsed.number), bookId ? eq(hymnNumbers.bookId, bookId) : undefined, ...conditions))
        .limit(PAGE + 1)
        .offset(offset);
      ids = rows.map((r) => r.id);
    } else if (parsed.text) {
      const doc = sql`to_tsvector('english', coalesce(${hymns.title}, '') || ' ' || ${hymns.firstLine} || ' ' || ${hymns.verses}::text)`;
      const query = sql`websearch_to_tsquery('english', ${parsed.text})`;
      const like = `%${escapeLike(parsed.text)}%`;
      const rows = await this.db
        .select({ id: hymns.id })
        .from(hymns)
        .where(
          and(
            ...conditions,
            bookId ? sql`exists (select 1 from ${hymnNumbers} where ${hymnNumbers.hymnId} = ${hymns.id} and ${hymnNumbers.bookId} = ${bookId})` : undefined,
            or(sql`${doc} @@ ${query}`, ilike(hymns.firstLine, like), ilike(hymns.title, like)),
          ),
        )
        .orderBy(desc(sql`(${hymns.firstLine} ilike ${like})`), desc(sql`ts_rank(${doc}, ${query})`), asc(hymns.firstLine))
        .limit(PAGE + 1)
        .offset(offset);
      ids = rows.map((r) => r.id);
    } else if (bookId) {
      // browse a book in its own order
      const rows = await this.db
        .select({ id: hymnNumbers.hymnId })
        .from(hymnNumbers)
        .innerJoin(hymns, eq(hymns.id, hymnNumbers.hymnId))
        .where(and(eq(hymnNumbers.bookId, bookId), ...conditions))
        .orderBy(asc(hymnNumbers.sortKey))
        .limit(PAGE + 1)
        .offset(offset);
      ids = rows.map((r) => r.id);
    } else {
      const rows = await this.db
        .select({ id: hymns.id })
        .from(hymns)
        .where(and(...conditions))
        .orderBy(asc(sql`coalesce(${hymns.title}, ${hymns.firstLine})`))
        .limit(PAGE + 1)
        .offset(offset);
      ids = rows.map((r) => r.id);
    }

    const hasMore = ids.length > PAGE;
    const items = await this.summaries(ids.slice(0, PAGE), opts.country ?? null);
    return {
      items,
      page: opts.page,
      hasMore,
      matchedNumber: parsed.number ? { book: bookCode, number: parsed.number } : null,
    };
  }

  /** Summaries for ids, in the given order. Three queries for the whole page. */
  private async summaries(ids: string[], country: string | null): Promise<HymnSummary[]> {
    if (!ids.length) return [];
    const [rows, nums, tags, media] = await Promise.all([
      this.db.select().from(hymns).where(inArray(hymns.id, ids)),
      this.numbersFor(ids),
      this.db.select().from(hymnTags).where(inArray(hymnTags.hymnId, ids)),
      this.db
        .select({ hymnId: hymnTunes.hymnId, kind: hymnMedia.kind })
        .from(hymnMedia)
        .innerJoin(hymnTunes, eq(hymnTunes.id, hymnMedia.tuneId))
        .where(inArray(hymnTunes.hymnId, ids)),
    ]);
    const byId = new Map(rows.map((r) => [r.id, r]));
    return ids
      .map((id) => byId.get(id))
      .filter((r): r is typeof hymns.$inferSelect => Boolean(r))
      .map((r) => {
        const kinds = media.filter((m) => m.hymnId === r.id).map((m) => m.kind);
        return {
          slug: r.slug,
          title: hymnDisplayTitle(r.title, r.firstLine),
          firstLine: r.firstLine,
          numbers: this.orderNumbers(nums.filter((n) => n.hymnId === r.id), country),
          tags: tags.filter((t) => t.hymnId === r.id).map((t) => t.tag).sort(),
          hasAudio: kinds.includes("AUDIO") || kinds.includes("YOUTUBE"),
          hasNotation: kinds.includes("STAFF_PDF") || kinds.includes("SOLFA_PDF"),
        };
      });
  }

  private numbersFor(ids: string[]) {
    return this.db
      .select({
        hymnId: hymnNumbers.hymnId,
        number: hymnNumbers.number,
        book: hymnBooks.code,
        bookName: hymnBooks.name,
        bookCountry: hymnBooks.country,
        bookOrder: hymnBooks.sortOrder,
      })
      .from(hymnNumbers)
      .innerJoin(hymnBooks, eq(hymnBooks.id, hymnNumbers.bookId))
      .where(inArray(hymnNumbers.hymnId, ids));
  }

  private orderNumbers(rows: Awaited<ReturnType<HymnalService["numbersFor"]>>, country: string | null) {
    return orderBookNumbers(rows, country).map((n) => ({ book: n.book, bookName: n.bookName, number: n.number }));
  }

  // ------------------------------------------------------------------ detail

  private async hymnBySlug(slug: string, includeUnpublished = false) {
    const [h] = await this.db
      .select()
      .from(hymns)
      .where(and(eq(hymns.slug, slug), includeUnpublished ? undefined : eq(hymns.isPublished, true)))
      .limit(1);
    if (!h) throw notFound("HYMN_NOT_FOUND", "hymn");
    return h;
  }

  private viewMedia(m: MediaRow, viewer: MediaViewer): HymnMedia {
    const available = canOpenMedia(m.access, viewer, this.paywall);
    return {
      id: m.id,
      kind: m.kind,
      label: m.label,
      access: m.access,
      isDefault: m.isDefault,
      available,
      youtubeId: available ? m.youtubeId : null,
      durationSec: m.durationSec,
    };
  }

  async bySlug(slug: string, country: string | null, viewer: MediaViewer): Promise<Hymn> {
    const h = await this.hymnBySlug(slug);
    const [summary] = await this.summaries([h.id], country);
    const tunes = await this.tunesWithMedia(h.id);
    return {
      ...summary!,
      author: h.author,
      verses: h.verses,
      source: h.source,
      tunes: tunes.map((t) => ({ ...t.tune, media: t.media.map((m) => this.viewMedia(m, viewer)) })),
    };
  }

  private async tunesWithMedia(hymnId: string) {
    const tunes = await this.db
      .select()
      .from(hymnTunes)
      .where(eq(hymnTunes.hymnId, hymnId))
      .orderBy(desc(hymnTunes.isDefault), asc(hymnTunes.position), asc(hymnTunes.name));
    const media = tunes.length
      ? await this.db
          .select()
          .from(hymnMedia)
          .where(inArray(hymnMedia.tuneId, tunes.map((t) => t.id)))
          .orderBy(asc(hymnMedia.kind), desc(hymnMedia.isDefault), asc(hymnMedia.position), asc(hymnMedia.label))
      : [];
    return tunes.map((t) => ({
      tune: { id: t.id, name: t.name, composer: t.composer, meter: t.meter, isDefault: t.isDefault },
      media: media.filter((m) => m.tuneId === t.id),
    }));
  }

  /** Short-lived URL to stream or download an uploaded file; 403 MEDIA_LOCKED behind the paywall. */
  async mediaUrl(id: string, viewer: MediaViewer, download: boolean) {
    const [row] = await this.db
      .select({ m: hymnMedia, published: hymns.isPublished, slug: hymns.slug })
      .from(hymnMedia)
      .innerJoin(hymnTunes, eq(hymnTunes.id, hymnMedia.tuneId))
      .innerJoin(hymns, eq(hymns.id, hymnTunes.hymnId))
      .where(eq(hymnMedia.id, id))
      .limit(1);
    if (!row || (!row.published && !viewer.staff) || !row.m.objectKey) throw notFound("MEDIA_NOT_FOUND", "file");
    if (!canOpenMedia(row.m.access, viewer, this.paywall))
      throw new DomainError(403, "MEDIA_LOCKED", "This item is for Ecclesios subscribers.");
    const ext = row.m.objectKey.split(".").pop();
    const url = await this.media.presignGet(row.m.objectKey, download ? `${row.slug}-${slugify(row.m.label)}.${ext}` : undefined);
    return { url, expiresInSeconds: this.media.ttl };
  }

  // ------------------------------------------------------------------ Super-Admin

  async adminList(q: string) {
    const like = `%${escapeLike(q.trim())}%`;
    const rows = await this.db
      .select({
        id: hymns.id,
        slug: hymns.slug,
        title: hymns.title,
        firstLine: hymns.firstLine,
        isPublished: hymns.isPublished,
        tunes: sql<number>`(select count(*)::int from ${hymnTunes} where ${hymnTunes.hymnId} = ${hymns.id})`,
        media: sql<number>`(select count(*)::int from ${hymnMedia} m join ${hymnTunes} t on t.id = m.tune_id where t.hymn_id = ${hymns.id})`,
      })
      .from(hymns)
      .where(q.trim() ? or(ilike(hymns.firstLine, like), ilike(hymns.title, like)) : undefined)
      .orderBy(asc(sql`coalesce(${hymns.title}, ${hymns.firstLine})`))
      .limit(200);
    const nums = await this.numbersFor(rows.map((r) => r.id));
    return rows.map((r) => ({
      slug: r.slug,
      title: hymnDisplayTitle(r.title, r.firstLine),
      numbers: this.orderNumbers(nums.filter((n) => n.hymnId === r.id), null),
      tunes: r.tunes,
      media: r.media,
      isPublished: r.isPublished,
    }));
  }

  async adminDetail(slug: string): Promise<AdminHymn> {
    const h = await this.hymnBySlug(slug, true);
    const [summary] = await this.summaries([h.id], null);
    const tunes = await this.tunesWithMedia(h.id);
    const staff: MediaViewer = { staff: true, subscribed: true };
    return {
      ...summary!,
      author: h.author,
      verses: h.verses,
      source: h.source,
      isPublished: h.isPublished,
      tunes: await Promise.all(
        tunes.map(async (t) => ({
          ...t.tune,
          media: await Promise.all(
            t.media.map(async (m) => ({
              ...this.viewMedia(m, staff),
              key: m.objectKey,
              url: m.objectKey ? await this.media.presignGet(m.objectKey) : null,
            })),
          ),
        })),
      ),
    };
  }

  /** Create (slug absent) or update a hymn, replacing its numbers and tags. */
  async upsert(userId: string, slug: string | null, body: z.output<typeof UpsertHymnSchema>, ip: string) {
    const { idOf } = await this.bookAliases();
    for (const n of body.numbers) if (!idOf.has(n.book)) throw notFound("BOOK_NOT_FOUND", `hymn book ${n.book}`);
    const finalSlug = slug ?? (await this.freeSlug(slugify(hymnDisplayTitle(body.title, body.firstLine))));
    try {
      await this.db.transaction(async (tx) => {
        const values = {
          title: body.title,
          firstLine: body.firstLine,
          author: body.author,
          verses: body.verses,
          source: body.source,
          isPublished: body.isPublished,
        };
        let id: string;
        if (slug) {
          const [row] = await tx.update(hymns).set(values).where(eq(hymns.slug, slug)).returning({ id: hymns.id });
          if (!row) throw notFound("HYMN_NOT_FOUND", "hymn");
          id = row.id;
        } else {
          const [row] = await tx.insert(hymns).values({ ...values, slug: finalSlug }).returning({ id: hymns.id });
          id = row!.id;
          await tx.insert(hymnTunes).values({ hymnId: id, name: "Default tune", isDefault: true });
        }
        await tx.delete(hymnNumbers).where(eq(hymnNumbers.hymnId, id));
        const seen = new Set<string>();
        const numbers = body.numbers.filter((n) => !seen.has(n.book) && seen.add(n.book));
        if (numbers.length)
          await tx.insert(hymnNumbers).values(
            numbers.map((n) => ({
              hymnId: id,
              bookId: idOf.get(n.book)!,
              number: normalizeHymnNumber(n.number),
              sortKey: hymnNumberKey(n.number),
            })),
          );
        await tx.delete(hymnTags).where(eq(hymnTags.hymnId, id));
        const tags = [...new Set(body.tags)];
        if (tags.length) await tx.insert(hymnTags).values(tags.map((tag) => ({ hymnId: id, tag })));
      });
    } catch (err) {
      if ((err as { code?: string }).code === "23505")
        throw new DomainError(409, "NUMBER_TAKEN", "That number is already used by another hymn in this book.");
      throw err;
    }
    await this.audit.write({ actorType: "USER", actorId: userId, action: slug ? "hymn.updated" : "hymn.created", entityType: "hymn", entityId: finalSlug, ip });
    return this.adminDetail(finalSlug);
  }

  private async freeSlug(base: string) {
    const root = base || "hymn";
    for (let i = 1; ; i++) {
      const candidate = i === 1 ? root : `${root}-${i}`;
      const [hit] = await this.db.select({ id: hymns.id }).from(hymns).where(eq(hymns.slug, candidate)).limit(1);
      if (!hit) return candidate;
    }
  }

  // tunes ------------------------------------------------------------
  private async tuneOf(slug: string, tuneId: string) {
    const h = await this.hymnBySlug(slug, true);
    const [t] = await this.db.select().from(hymnTunes).where(and(eq(hymnTunes.id, tuneId), eq(hymnTunes.hymnId, h.id))).limit(1);
    if (!t) throw notFound("TUNE_NOT_FOUND", "tune");
    return { hymn: h, tune: t };
  }

  async addTune(slug: string, body: z.output<typeof UpsertTuneSchema>) {
    const h = await this.hymnBySlug(slug, true);
    await this.db.transaction(async (tx) => {
      const [{ n }] = (await tx.select({ n: count() }).from(hymnTunes).where(eq(hymnTunes.hymnId, h.id))) as [{ n: number }];
      const makeDefault = body.isDefault || n === 0;
      if (makeDefault) await tx.update(hymnTunes).set({ isDefault: false }).where(eq(hymnTunes.hymnId, h.id));
      await tx.insert(hymnTunes).values({ ...body, isDefault: makeDefault, hymnId: h.id, position: n });
    });
    return this.adminDetail(slug);
  }

  async updateTune(slug: string, tuneId: string, body: z.output<typeof UpsertTuneSchema>) {
    const { hymn } = await this.tuneOf(slug, tuneId);
    await this.db.transaction(async (tx) => {
      if (body.isDefault) await tx.update(hymnTunes).set({ isDefault: false }).where(eq(hymnTunes.hymnId, hymn.id));
      await tx.update(hymnTunes).set(body).where(eq(hymnTunes.id, tuneId));
    });
    return this.adminDetail(slug);
  }

  async removeTune(slug: string, tuneId: string) {
    const { hymn, tune } = await this.tuneOf(slug, tuneId);
    const media = await this.db.select().from(hymnMedia).where(eq(hymnMedia.tuneId, tuneId));
    await this.db.transaction(async (tx) => {
      await tx.delete(hymnTunes).where(eq(hymnTunes.id, tuneId));
      if (tune.isDefault) {
        const [next] = await tx.select().from(hymnTunes).where(eq(hymnTunes.hymnId, hymn.id)).orderBy(asc(hymnTunes.position)).limit(1);
        if (next) await tx.update(hymnTunes).set({ isDefault: true }).where(eq(hymnTunes.id, next.id));
      }
    });
    await Promise.all(media.filter((m) => m.objectKey).map((m) => this.media.remove(m.objectKey!)));
    return this.adminDetail(slug);
  }

  // media ------------------------------------------------------------
  async presignUpload(slug: string, tuneId: string, kind: Upload["kind"], contentType: string, bytes: number) {
    const { hymn } = await this.tuneOf(slug, tuneId);
    if (!MEDIA_CONTENT_TYPES[kind].includes(contentType))
      throw new DomainError(400, "UPLOAD_REJECTED", `That file type isn't accepted for ${kind}.`);
    if (bytes > MAX_UPLOAD_BYTES[kind])
      throw new DomainError(400, "UPLOAD_REJECTED", `The file is too large (max ${Math.round(MAX_UPLOAD_BYTES[kind] / 1048576)} MB).`);
    const key = this.media.newKey(`hymns/${hymn.id}/${tuneId}`, contentType);
    return this.media.presignPut(key, contentType, bytes);
  }

  async addMedia(userId: string, slug: string, tuneId: string, body: z.output<typeof AddMediaSchema>, ip: string) {
    const { hymn } = await this.tuneOf(slug, tuneId);
    let objectKey: string | null = null;
    let contentType: string | null = null;
    let bytes: number | null = null;
    let yt: string | null = null;
    if (body.kind === "YOUTUBE") {
      yt = youTubeId(body.url);
      if (!yt) throw new DomainError(400, "INVALID_YOUTUBE_LINK", "Paste a YouTube or YouTube Music link.");
    } else {
      // The key must be one we issued for this tune, and the object must exist with an allowed type.
      if (!body.key.startsWith(`hymns/${hymn.id}/${tuneId}/`))
        throw new DomainError(400, "UPLOAD_REJECTED", "That upload doesn't belong to this tune.");
      const head = await this.media.head(body.key);
      if (!head) throw new DomainError(400, "UPLOAD_REJECTED", "The file hasn't finished uploading.");
      if (!head.contentType || !MEDIA_CONTENT_TYPES[body.kind].includes(head.contentType)) {
        await this.media.remove(body.key);
        throw new DomainError(400, "UPLOAD_REJECTED", `That file type isn't accepted for ${body.kind}.`);
      }
      objectKey = body.key;
      contentType = head.contentType;
      bytes = head.bytes;
    }
    const isDefault = body.kind === "AUDIO" && body.isDefault;
    const access = body.access ?? defaultMediaAccess(body.kind, isDefault);
    await this.db.transaction(async (tx) => {
      if (isDefault) await tx.update(hymnMedia).set({ isDefault: false }).where(and(eq(hymnMedia.tuneId, tuneId), eq(hymnMedia.kind, "AUDIO")));
      const [{ n }] = (await tx.select({ n: count() }).from(hymnMedia).where(eq(hymnMedia.tuneId, tuneId))) as [{ n: number }];
      await tx.insert(hymnMedia).values({
        tuneId,
        kind: body.kind,
        label: body.label,
        access,
        isDefault,
        objectKey,
        contentType,
        bytes,
        durationSec: body.kind === "YOUTUBE" ? null : body.durationSec,
        youtubeId: yt,
        position: n,
      });
    });
    await this.audit.write({ actorType: "USER", actorId: userId, action: "hymn.media_added", entityType: "hymn", entityId: slug, metadata: { kind: body.kind, access }, ip });
    return this.adminDetail(slug);
  }

  private async mediaOf(slug: string, mediaId: string) {
    const h = await this.hymnBySlug(slug, true);
    const [row] = await this.db
      .select({ m: hymnMedia })
      .from(hymnMedia)
      .innerJoin(hymnTunes, eq(hymnTunes.id, hymnMedia.tuneId))
      .where(and(eq(hymnMedia.id, mediaId), eq(hymnTunes.hymnId, h.id)))
      .limit(1);
    if (!row) throw notFound("MEDIA_NOT_FOUND", "file");
    return row.m;
  }

  async updateMedia(slug: string, mediaId: string, body: z.output<typeof UpdateMediaSchema>) {
    const m = await this.mediaOf(slug, mediaId);
    await this.db.transaction(async (tx) => {
      if (body.isDefault && m.kind === "AUDIO")
        await tx.update(hymnMedia).set({ isDefault: false }).where(and(eq(hymnMedia.tuneId, m.tuneId), eq(hymnMedia.kind, "AUDIO")));
      await tx
        .update(hymnMedia)
        .set({ ...body, isDefault: m.kind === "AUDIO" ? (body.isDefault ?? m.isDefault) : false })
        .where(eq(hymnMedia.id, mediaId));
    });
    return this.adminDetail(slug);
  }

  async removeMedia(userId: string, slug: string, mediaId: string, ip: string) {
    const m = await this.mediaOf(slug, mediaId);
    await this.db.delete(hymnMedia).where(eq(hymnMedia.id, mediaId));
    if (m.objectKey) await this.media.remove(m.objectKey);
    await this.audit.write({ actorType: "USER", actorId: userId, action: "hymn.media_removed", entityType: "hymn", entityId: slug, metadata: { kind: m.kind }, ip });
    return this.adminDetail(slug);
  }
}
