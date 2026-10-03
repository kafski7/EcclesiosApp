import { sql } from "drizzle-orm";
import { index, pgTable, primaryKey, smallint, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_common";
import { teachingStatusEnum } from "./enums";

/**
 * Teachings (functionality §3.7, D-030). Official catechesis, written by Super-Admins.
 * `body` is the D-030 text format (never HTML); `plain` is its plain text for search.
 */
export const teachingTopics = pgTable("teaching_topics", {
  id: id(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 80 }).notNull(),
  description: varchar("description", { length: 400 }).notNull().default(""),
  position: smallint("position").notNull().default(0),
  ...timestamps(),
});

export const teachings = pgTable(
  "teachings",
  {
    id: id(),
    slug: varchar("slug", { length: 100 }).notNull().unique(),
    title: varchar("title", { length: 160 }).notNull(),
    summary: varchar("summary", { length: 300 }).notNull(),
    body: text("body").notNull(),
    plain: text("plain").notNull().default(""),
    readingMinutes: smallint("reading_minutes").notNull().default(1),
    reviewedBy: varchar("reviewed_by", { length: 160 }),
    source: varchar("source", { length: 200 }),
    status: teachingStatusEnum("status").notNull().default("DRAFT"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    index("teachings_status_idx").on(t.status, t.publishedAt),
    index("teachings_fts_idx").using(
      "gin",
      sql`(setweight(to_tsvector('english', ${t.title}), 'A') || setweight(to_tsvector('english', ${t.summary}), 'B') || setweight(to_tsvector('english', ${t.plain}), 'C'))`,
    ),
  ],
);

export const teachingTopicLinks = pgTable(
  "teaching_topic_links",
  {
    teachingId: uuid("teaching_id")
      .notNull()
      .references(() => teachings.id, { onDelete: "cascade" }),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => teachingTopics.id, { onDelete: "restrict" }),
    position: smallint("position").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.teachingId, t.topicId] }), index("teaching_topic_links_topic_idx").on(t.topicId)],
);

/** Explicit "Related" links, chosen by the writer (one direction; shown on `from`). */
export const teachingRelations = pgTable(
  "teaching_relations",
  {
    fromId: uuid("from_id")
      .notNull()
      .references(() => teachings.id, { onDelete: "cascade" }),
    toId: uuid("to_id")
      .notNull()
      .references(() => teachings.id, { onDelete: "cascade" }),
    position: smallint("position").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.fromId, t.toId] })],
);
