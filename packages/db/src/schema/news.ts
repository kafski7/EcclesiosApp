import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { id, timestamps } from "./_common";
import { newsCategoryEnum, newsStatusEnum } from "./enums";
import { hymns } from "./hymnal";
import { users } from "./identity";

/**
 * Platform news (D-032): official Ecclesios announcements, written by Super-Admins.
 * Body uses the lesson format (D-030). A future publish time schedules the item.
 */
export const news = pgTable(
  "news",
  {
    id: id(),
    slug: varchar("slug", { length: 100 }).notNull().unique(),
    title: varchar("title", { length: 140 }).notNull(),
    summary: varchar("summary", { length: 280 }).notNull(),
    body: text("body").notNull().default(""),
    category: newsCategoryEnum("category").notNull().default("ANNOUNCEMENT"),
    pinned: boolean("pinned").notNull().default(false),
    linkUrl: varchar("link_url", { length: 500 }),
    linkLabel: varchar("link_label", { length: 40 }),
    coverKey: text("cover_key"),
    status: newsStatusEnum("status").notNull().default("DRAFT"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    authorUserId: uuid("author_user_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps(),
  },
  (t) => [
    index("news_live_idx").on(t.status, t.publishedAt),
    check("news_live_chk", sql`${t.status} = 'DRAFT' OR ${t.publishedAt} IS NOT NULL`),
  ],
);

/** A Super-Admin's choice of hymn of the day for a date (D-033); otherwise it is computed. */
export const hymnPicks = pgTable("hymn_picks", {
  date: date("date").primaryKey(),
  hymnId: uuid("hymn_id")
    .notNull()
    .references(() => hymns.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
