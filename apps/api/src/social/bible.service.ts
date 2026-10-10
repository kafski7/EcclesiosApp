import { Inject, Injectable } from "@nestjs/common";
import { bibleTranslations, bibleVerses } from "@ecclesios/db";
import type { BibleBook, BibleChapter, BibleSearchHit, BibleTranslation } from "@ecclesios/shared";
import { bookByCode, CANON, canonIndex } from "@ecclesios/shared/domain";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { DomainError } from "../auth/core/errors";
import { DB, type Database } from "../db/db.module";
import { qcol } from "../db/qualified";

const notFound = (code: string, message: string) => new DomainError(404, code, message);

/** Bible reader (functionality §3.8, D-023). Read-only, public. */
@Injectable()
export class BibleService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async translations(): Promise<BibleTranslation[]> {
    const rows = await this.db
      .select({
        code: bibleTranslations.code,
        name: bibleTranslations.name,
        language: bibleTranslations.language,
        attribution: bibleTranslations.attribution,
        isDefault: bibleTranslations.isDefault,
        offlineAllowed: bibleTranslations.offlineAllowed,
        psalmNumbering: bibleTranslations.psalmNumbering,
        booksLoaded: sql<number>`(select count(distinct v.book)::int from ${bibleVerses} v where v.translation_id = ${qcol(bibleTranslations, bibleTranslations.id)})`,
      })
      .from(bibleTranslations)
      .where(eq(bibleTranslations.isActive, true))
      .orderBy(desc(bibleTranslations.isDefault), asc(bibleTranslations.name));
    return rows;
  }

  private async translation(code: string) {
    const [t] = await this.db
      .select()
      .from(bibleTranslations)
      .where(
        and(eq(bibleTranslations.code, code.toUpperCase()), eq(bibleTranslations.isActive, true)),
      )
      .limit(1);
    if (!t) throw notFound("TRANSLATION_NOT_FOUND", "That Bible translation isn't available.");
    return t;
  }

  /** The 73 books in canonical order, with how many chapters this translation has loaded. */
  async books(code: string): Promise<{ translation: string; items: BibleBook[] }> {
    const t = await this.translation(code);
    const loaded = await this.db
      .select({ book: bibleVerses.book, chapters: sql<number>`max(${bibleVerses.chapter})::int` })
      .from(bibleVerses)
      .where(eq(bibleVerses.translationId, t.id))
      .groupBy(bibleVerses.book);
    const count = new Map(loaded.map((r) => [r.book, r.chapters]));
    return {
      translation: t.code,
      items: CANON.map((b) => ({
        code: b.code,
        name: b.name,
        testament: b.testament,
        deutero: Boolean(b.deutero),
        chapters: count.get(b.code) ?? 0,
      })),
    };
  }

  async chapter(code: string, bookCode: string, chapter: number): Promise<BibleChapter> {
    const t = await this.translation(code);
    const book = bookByCode(bookCode);
    if (!book) throw notFound("BOOK_NOT_FOUND", "That book isn't in the Bible.");
    const verses = await this.db
      .select({ verse: bibleVerses.verse, text: bibleVerses.text, woj: bibleVerses.woj })
      .from(bibleVerses)
      .where(
        and(
          eq(bibleVerses.translationId, t.id),
          eq(bibleVerses.book, book.code),
          eq(bibleVerses.chapter, chapter),
        ),
      )
      .orderBy(asc(bibleVerses.verse));
    if (!verses.length)
      throw notFound(
        "CHAPTER_NOT_FOUND",
        `${book.name} ${chapter} isn't available in ${t.name} yet.`,
      );

    // prev / next across book boundaries, over the chapters this translation actually has
    const chapters = await this.db
      .select({ book: bibleVerses.book, chapter: sql<number>`max(${bibleVerses.chapter})::int` })
      .from(bibleVerses)
      .where(eq(bibleVerses.translationId, t.id))
      .groupBy(bibleVerses.book);
    const last = new Map(chapters.map((c) => [c.book, c.chapter]));
    const ordered = CANON.filter((b) => last.has(b.code)).map((b) => b.code);
    const i = ordered.indexOf(book.code);
    const prev =
      chapter > 1
        ? { book: book.code, chapter: chapter - 1 }
        : i > 0
          ? { book: ordered[i - 1]!, chapter: last.get(ordered[i - 1]!)! }
          : null;
    const next =
      chapter < (last.get(book.code) ?? 0)
        ? { book: book.code, chapter: chapter + 1 }
        : i >= 0 && i < ordered.length - 1
          ? { book: ordered[i + 1]!, chapter: 1 }
          : null;

    return {
      translation: { code: t.code, name: t.name, attribution: t.attribution },
      book: { code: book.code, name: book.name },
      chapter,
      verses,
      prev,
      next,
    };
  }

  /** Full-text search within one translation, canonical order (blueprint §6). */
  async search(code: string, q: string, limit: number): Promise<BibleSearchHit[]> {
    const t = await this.translation(code);
    const query = sql`websearch_to_tsquery('english', ${q})`;
    const rows = await this.db
      .select({
        book: bibleVerses.book,
        chapter: bibleVerses.chapter,
        verse: bibleVerses.verse,
        text: bibleVerses.text,
      })
      .from(bibleVerses)
      .where(
        and(
          eq(bibleVerses.translationId, t.id),
          sql`to_tsvector('english', ${bibleVerses.text}) @@ ${query}`,
        ),
      )
      .limit(500);
    return rows
      .sort(
        (a, b) =>
          canonIndex(a.book) - canonIndex(b.book) || a.chapter - b.chapter || a.verse - b.verse,
      )
      .slice(0, limit)
      .map((r) => ({ ...r, bookName: bookByCode(r.book)?.name ?? r.book }));
  }
}
