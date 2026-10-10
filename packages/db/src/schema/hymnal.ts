import { sql } from "drizzle-orm";
import {
  boolean,
  char,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { id, timestamps } from "./_common";
import { mediaAccessEnum, mediaKindEnum } from "./enums";

/**
 * Hymnal (functionality §3.6, D-026).
 * Numbers belong to BOOKS, not hymns: one hymn can be NCH 56 and CH 12 and something else elsewhere.
 * All binaries are object-storage keys (blueprint §5).
 */
export const hymnBooks = pgTable("hymn_books", {
  id: id(),
  code: varchar("code", { length: 10 }).notNull().unique(),
  name: varchar("name", { length: 200 }).notNull(),
  /** ISO 3166 alpha-2; null = international. */
  country: char("country", { length: 2 }),
  publisher: varchar("publisher", { length: 200 }),
  /** Display order within a country. */
  sortOrder: smallint("sort_order").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps(),
});

export const hymns = pgTable(
  "hymns",
  {
    id: id(),
    slug: varchar("slug", { length: 100 }).notNull().unique(),
    title: varchar("title", { length: 200 }),
    firstLine: varchar("first_line", { length: 300 }).notNull(),
    author: varchar("author", { length: 200 }),
    /** [{ label: "1", lines: [...] }, { label: "R", lines: [...] }] */
    verses: jsonb("verses").$type<{ label: string; lines: string[] }[]>().notNull().default([]),
    /** Licence / permission note (D-026). */
    source: varchar("source", { length: 200 }),
    isPublished: boolean("is_published").notNull().default(true),
    ...timestamps(),
  },
  (t) => [
    // title + first line + lyrics, searched with websearch_to_tsquery
    index("hymns_fts_idx").using(
      "gin",
      sql`to_tsvector('english', coalesce(${t.title}, '') || ' ' || ${t.firstLine} || ' ' || ${t.verses}::text)`,
    ),
  ],
);

export const hymnNumbers = pgTable(
  "hymn_numbers",
  {
    hymnId: uuid("hymn_id")
      .notNull()
      .references(() => hymns.id, { onDelete: "cascade" }),
    bookId: uuid("book_id")
      .notNull()
      .references(() => hymnBooks.id, { onDelete: "restrict" }),
    /** Text so "246a" works; normalised lower-case without leading zeros. */
    number: varchar("number", { length: 8 }).notNull(),
    /** Numeric sort key (hymnNumberKey). */
    sortKey: integer("sort_key").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.hymnId, t.bookId] }),
    uniqueIndex("hymn_numbers_book_number_uq").on(t.bookId, t.number),
    index("hymn_numbers_number_idx").on(t.number),
  ],
);

/** Season / occasion tags: advent, entrance, communion, marian… */
export const hymnTags = pgTable(
  "hymn_tags",
  {
    hymnId: uuid("hymn_id")
      .notNull()
      .references(() => hymns.id, { onDelete: "cascade" }),
    tag: varchar("tag", { length: 50 }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.hymnId, t.tag] }), index("hymn_tags_tag_idx").on(t.tag)],
);

export const hymnTunes = pgTable(
  "hymn_tunes",
  {
    id: id(),
    hymnId: uuid("hymn_id")
      .notNull()
      .references(() => hymns.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    composer: varchar("composer", { length: 200 }),
    meter: varchar("meter", { length: 40 }),
    isDefault: boolean("is_default").notNull().default(false),
    position: smallint("position").notNull().default(0),
    ...timestamps(),
  },
  (t) => [
    index("hymn_tunes_hymn_idx").on(t.hymnId),
    uniqueIndex("hymn_tunes_one_default_uq")
      .on(t.hymnId)
      .where(sql`${t.isDefault}`),
  ],
);

export const hymnMedia = pgTable(
  "hymn_media",
  {
    id: id(),
    tuneId: uuid("tune_id")
      .notNull()
      .references(() => hymnTunes.id, { onDelete: "cascade" }),
    kind: mediaKindEnum("kind").notNull(),
    label: varchar("label", { length: 60 }).notNull(),
    access: mediaAccessEnum("access").notNull(),
    /** One default recording per tune (the free one). */
    isDefault: boolean("is_default").notNull().default(false),
    /** Object-storage key (uploaded kinds) … */
    objectKey: text("object_key"),
    contentType: varchar("content_type", { length: 100 }),
    bytes: integer("bytes"),
    durationSec: integer("duration_sec"),
    /** … or a YouTube video id. */
    youtubeId: varchar("youtube_id", { length: 11 }),
    position: smallint("position").notNull().default(0),
    ...timestamps(),
  },
  (t) => [
    index("hymn_media_tune_idx").on(t.tuneId),
    uniqueIndex("hymn_media_one_default_audio_uq")
      .on(t.tuneId)
      .where(sql`${t.isDefault} AND ${t.kind} = 'AUDIO'`),
    check(
      "hymn_media_source_chk",
      sql`(${t.kind} = 'YOUTUBE') = (${t.youtubeId} IS NOT NULL) AND (${t.kind} = 'YOUTUBE') = (${t.objectKey} IS NULL)`,
    ),
  ],
);
