import { Inject, Injectable } from "@nestjs/common";
import { saints } from "@ecclesios/db";
import type { Saint, SaintSummary, SaintsToday, UpsertSaintSchema } from "@ecclesios/shared";
import { compareFeasts, feastOf, saintsOn } from "@ecclesios/shared/domain";
import { and, eq, ilike, or, sql } from "drizzle-orm";
import type { z } from "zod";
import { AuditService } from "../audit/audit.service";
import { DomainError } from "../auth/core/errors";
import { DB, type Database } from "../db/db.module";
import { MediaService } from "../media/media.service";

type Row = typeof saints.$inferSelect;
type Upsert = z.output<typeof UpsertSaintSchema>;

export const PORTRAIT_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const PORTRAIT_MAX_BYTES = 5 * 1024 * 1024;

/** imageUrl is filled in by withImage (presigned GET, D-026 media module). */
const summary = (r: Row): SaintSummary => ({
  slug: r.slug,
  name: r.name,
  title: r.title,
  feastMonth: r.feastMonth,
  feastDay: r.feastDay,
  rank: r.rank,
  summary: r.summary,
  patronage: r.patronage,
  imageUrl: null,
});

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Saints directory and saint of the day (functionality §3.3, D-025). */
@Injectable()
export class SaintsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
    private readonly media: MediaService,
  ) {}

  private async withImage<T extends { imageUrl: string | null }>(item: T, key: string | null): Promise<T> {
    return key ? { ...item, imageUrl: await this.media.presignGet(key) } : item;
  }

  async today(date: string): Promise<SaintsToday> {
    const { month, day } = feastOf(date);
    const rows = await this.db
      .select()
      .from(saints)
      .where(and(eq(saints.isPublished, true), eq(saints.feastMonth, month), eq(saints.feastDay, day)));
    const ordered = await Promise.all(saintsOn(rows, date).map((r) => this.withImage(summary(r), r.imageKey)));
    return { date, saint: ordered[0] ?? null, others: ordered.slice(1) };
  }

  async list(q: string, month?: number): Promise<SaintSummary[]> {
    const term = q.trim();
    const rows = await this.db
      .select()
      .from(saints)
      .where(
        and(
          eq(saints.isPublished, true),
          month ? eq(saints.feastMonth, month) : undefined,
          term
            ? or(
                ilike(saints.name, `%${escapeLike(term)}%`),
                ilike(saints.summary, `%${escapeLike(term)}%`),
                sql`${saints.patronage}::text ilike ${`%${escapeLike(term)}%`}`,
              )
            : undefined,
        ),
      )
      .limit(400);
    return Promise.all(rows.sort(compareFeasts).map((r) => this.withImage(summary(r), r.imageKey)));
  }

  async bySlug(slug: string): Promise<Saint> {
    const [r] = await this.db
      .select()
      .from(saints)
      .where(and(eq(saints.slug, slug), eq(saints.isPublished, true)))
      .limit(1);
    if (!r) throw new DomainError(404, "SAINT_NOT_FOUND", "We couldn't find that saint.");
    return this.withImage({ ...summary(r), born: r.born, died: r.died, biography: r.biography, source: r.source }, r.imageKey);
  }

  /** Super-Admin: create or replace by slug. Unpublished saints are hidden from the public. */
  async upsert(userId: string, slug: string, body: Upsert, ip: string) {
    const values = {
      slug,
      name: body.name,
      title: body.title,
      feastMonth: body.feastMonth,
      feastDay: body.feastDay,
      rank: body.rank,
      summary: body.summary,
      patronage: body.patronage,
      born: body.born,
      died: body.died,
      biography: body.biography,
      source: body.source,
      isPublished: body.isPublished,
    };
    const [r] = await this.db
      .insert(saints)
      .values(values)
      .onConflictDoUpdate({ target: saints.slug, set: { ...values, updatedAt: new Date() } })
      .returning();
    await this.audit.write({ actorType: "USER", actorId: userId, action: "saints.upserted", entityType: "saint", entityId: slug, ip });
    return { ...summary(r!), born: r!.born, died: r!.died, biography: r!.biography, source: r!.source, isPublished: r!.isPublished };
  }

  // ------------------------------------------------------------------ portraits (Super-Admin)

  private async idOf(slug: string) {
    const [r] = await this.db.select({ id: saints.id, imageKey: saints.imageKey }).from(saints).where(eq(saints.slug, slug)).limit(1);
    if (!r) throw new DomainError(404, "SAINT_NOT_FOUND", "We couldn't find that saint.");
    return r;
  }

  async presignPortrait(slug: string, contentType: string, bytes: number) {
    const { id } = await this.idOf(slug);
    if (!PORTRAIT_TYPES.includes(contentType)) throw new DomainError(400, "UPLOAD_REJECTED", "Use a JPEG, PNG or WebP image.");
    if (bytes > PORTRAIT_MAX_BYTES) throw new DomainError(400, "UPLOAD_REJECTED", "The image is too large (max 5 MB).");
    return this.media.presignPut(this.media.newKey(`saints/${id}`, contentType), contentType, bytes);
  }

  async setPortrait(userId: string, slug: string, key: string | null, ip: string) {
    const { id, imageKey } = await this.idOf(slug);
    if (key) {
      if (!key.startsWith(`saints/${id}/`)) throw new DomainError(400, "UPLOAD_REJECTED", "That upload doesn't belong to this saint.");
      const head = await this.media.head(key);
      if (!head || !head.contentType || !PORTRAIT_TYPES.includes(head.contentType))
        throw new DomainError(400, "UPLOAD_REJECTED", "The image hasn't finished uploading or isn't an image.");
    }
    await this.db.update(saints).set({ imageKey: key }).where(eq(saints.id, id));
    if (imageKey && imageKey !== key) await this.media.remove(imageKey);
    await this.audit.write({ actorType: "USER", actorId: userId, action: key ? "saints.portrait_set" : "saints.portrait_removed", entityType: "saint", entityId: slug, ip });
    return this.bySlug(slug).catch(() => null);
  }
}
