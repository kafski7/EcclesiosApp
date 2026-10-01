import { char, jsonb, pgTable, serial, smallint, text, varchar } from "drizzle-orm/pg-core";

export const themes = pgTable("themes", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  /** Design tokens (colours etc.) consumed by web/admin. */
  tokens: jsonb("tokens").$type<Record<string, string>>().notNull().default({}),
});

export const currencies = pgTable("currencies", {
  code: char("code", { length: 3 }).primaryKey(), // ISO 4217, e.g. GHS
  name: varchar("name", { length: 100 }).notNull(),
  symbol: varchar("symbol", { length: 10 }).notNull(),
  minorUnit: smallint("minor_unit").notNull().default(2),
});

export const languages = pgTable("languages", {
  code: varchar("code", { length: 10 }).primaryKey(), // BCP 47, e.g. en, tw
  name: varchar("name", { length: 100 }).notNull(),
});

export const icons = pgTable("icons", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  /** Icon-set class or SVG object key. */
  value: text("value").notNull(),
});
