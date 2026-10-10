import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  smallint,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { timestamps } from "./_common";

/**
 * Bible text (functionality §3.8, D-023). Several translations side by side; the canon
 * (book order, names) lives in @ecclesios/shared/domain/bible.ts, keyed by USFM book codes.
 */
export const bibleTranslations = pgTable(
  "bible_translations",
  {
    id: serial("id").primaryKey(),
    /** e.g. WEBC (World English Bible, Catholic), DRA (Douay-Rheims). */
    code: varchar("code", { length: 16 }).notNull().unique(),
    name: varchar("name", { length: 120 }).notNull(),
    language: varchar("language", { length: 10 }).notNull().default("en"),
    attribution: text("attribution").notNull(),
    /** Licence note for admins (public domain, licensed until…, etc.). */
    licence: text("licence").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    offlineAllowed: boolean("offline_allowed").notNull().default(false),
    /** HEBREW (most Bibles, lectionary citations) or VULGATE (Douay-Rheims) — D-024. */
    psalmNumbering: varchar("psalm_numbering", { length: 8 })
      .$type<"HEBREW" | "VULGATE">()
      .notNull()
      .default("HEBREW"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("bible_translations_one_default_uq")
      .on(t.isDefault)
      .where(sql`${t.isDefault}`),
  ],
);

export const bibleVerses = pgTable(
  "bible_verses",
  {
    translationId: integer("translation_id")
      .notNull()
      .references(() => bibleTranslations.id, { onDelete: "cascade" }),
    book: varchar("book", { length: 3 }).notNull(),
    chapter: smallint("chapter").notNull(),
    verse: smallint("verse").notNull(),
    text: text("text").notNull(),
    /** Words-of-Jesus spans: [[start, end), …] offsets into text. */
    woj: jsonb("woj").$type<[number, number][]>().notNull().default([]),
  },
  (t) => [
    uniqueIndex("bible_verses_ref_uq").on(t.translationId, t.book, t.chapter, t.verse),
    // Full-text search per translation (functionality §3.8, blueprint §6).
    index("bible_verses_fts_idx").using("gin", sql`to_tsvector('english', ${t.text})`),
  ],
);
