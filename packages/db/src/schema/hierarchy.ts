import { sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  boolean,
  char,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { id, timestamps } from "./_common";
import { hierarchyLevelEnum, metropolitanVisibilityEnum } from "./enums";
import { currencies, languages, themes } from "./reference";

/**
 * The hierarchy tree (blueprint §3). `path` is the materialised path (§3.5):
 * "/<rootId>/…/<ownId>/", maintained by the app on insert/move (buildPath in @ecclesios/shared).
 * Parent/level validity is checked app-side with isValidParent.
 */
export const groups = pgTable(
  "groups",
  {
    id: id(),
    parentGroupId: uuid("parent_group_id").references((): AnyPgColumn => groups.id, {
      onDelete: "restrict",
    }),
    level: hierarchyLevelEnum("level").notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    code: varchar("code", { length: 50 }).unique(),
    path: text("path").notNull().unique(),
    themeId: integer("theme_id").references(() => themes.id),
    currencyCode: char("currency_code", { length: 3 }).references(() => currencies.code),
    languageCode: varchar("language_code", { length: 10 }).references(() => languages.code),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps(),
  },
  (t) => [
    index("groups_parent_idx").on(t.parentGroupId),
    index("groups_level_idx").on(t.level),
    // Makes `path LIKE '/a/b/%'` an index range scan.
    index("groups_path_prefix_idx").using("btree", t.path.op("text_pattern_ops")),
    check(
      "groups_root_levels_chk",
      sql`${t.parentGroupId} IS NOT NULL OR ${t.level} IN ('VATICAN','NUNCIATURE','PROVINCE')`,
    ),
    check("groups_path_shape_chk", sql`${t.path} LIKE '/%/'`),
  ],
);

export const groupSettings = pgTable("group_settings", {
  groupId: uuid("group_id")
    .primaryKey()
    .references(() => groups.id, { onDelete: "cascade" }),
  /** Only meaningful for suffragan dioceses (blueprint §3.4, D-002). */
  metropolitanVisibility: metropolitanVisibilityEnum("metropolitan_visibility")
    .notNull()
    .default("aggregates"),
  allowManualTransactionDates: boolean("allow_manual_transaction_dates").notNull().default(false),
  extra: jsonb("extra").$type<Record<string, unknown>>().notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  updatedByMemberId: uuid("updated_by_member_id"),
});
