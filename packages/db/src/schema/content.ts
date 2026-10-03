import { sql } from "drizzle-orm";
import { boolean, check, date, index, jsonb, pgTable, smallint, text, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_common";
import { celebrationRankEnum, liturgicalColorEnum, readingKindEnum } from "./enums";

/**
 * Daily Mass readings (functionality §3.2, D-022). One row per civil date that has readings loaded.
 * Season and Sunday/weekday cycle are computed from the date (packages/shared liturgy.ts), not stored.
 */
export const readingDays = pgTable("reading_days", {
  id: id(),
  date: date("date").notNull().unique(),
  /** Feast, memorial or Sunday title; null on an ordinary weekday. */
  celebration: varchar("celebration", { length: 200 }),
  /** Overrides the season colour (e.g. red for a martyr). */
  color: liturgicalColorEnum("color"),
  /** Translation / source credit shown with the text (licensing, D-022). */
  source: varchar("source", { length: 200 }),
  ...timestamps(),
});

export const readings = pgTable(
  "readings",
  {
    id: id(),
    readingDayId: uuid("reading_day_id")
      .notNull()
      .references(() => readingDays.id, { onDelete: "cascade" }),
    position: smallint("position").notNull(),
    kind: readingKindEnum("kind").notNull(),
    citation: varchar("citation", { length: 120 }).notNull(),
    response: text("response"),
    /** Paragraphs as a JSON array of strings. */
    text: jsonb("text").$type<string[]>().notNull().default([]),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("readings_day_position_uq").on(t.readingDayId, t.position),
    index("readings_day_idx").on(t.readingDayId),
    check("readings_position_chk", sql`${t.position} BETWEEN 0 AND 20`),
  ],
);

export type ReadingDayRow = typeof readingDays.$inferSelect;
export type ReadingRow = typeof readings.$inferSelect;

/**
 * Saints directory (functionality §3.3, D-025). Feasts are fixed month/day dates; the saint of the
 * day is the highest-ranked published saint on today's date. Images are object-storage keys.
 */
export const saints = pgTable(
  "saints",
  {
    id: id(),
    slug: varchar("slug", { length: 80 }).notNull().unique(),
    name: varchar("name", { length: 120 }).notNull(),
    title: varchar("title", { length: 120 }),
    feastMonth: smallint("feast_month").notNull(),
    feastDay: smallint("feast_day").notNull(),
    rank: celebrationRankEnum("rank").notNull(),
    summary: varchar("summary", { length: 280 }).notNull(),
    patronage: jsonb("patronage").$type<string[]>().notNull().default([]),
    born: varchar("born", { length: 60 }),
    died: varchar("died", { length: 60 }),
    biography: jsonb("biography").$type<string[]>().notNull().default([]),
    source: varchar("source", { length: 200 }),
    imageKey: text("image_key"),
    isPublished: boolean("is_published").notNull().default(true),
    ...timestamps(),
  },
  (t) => [
    index("saints_feast_idx").on(t.feastMonth, t.feastDay),
    check("saints_feast_chk", sql`${t.feastMonth} BETWEEN 1 AND 12 AND ${t.feastDay} BETWEEN 1 AND 31`),
  ],
);
