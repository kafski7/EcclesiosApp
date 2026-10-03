import { index, pgTable, primaryKey, timestamp, uuid } from "drizzle-orm/pg-core";
import { engageKindEnum, reactionTypeEnum } from "./enums";
import { members } from "./identity";

/**
 * Likes and saves (D-035) on posts, teachings, podcast episodes and hymns.
 * `item_id` points at the item's table according to `kind` (no FK — one table for all kinds);
 * the API only counts reactions on items that are still public, and services delete reactions
 * when an item is deleted.
 */
export const reactions = pgTable(
  "reactions",
  {
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    kind: engageKindEnum("kind").notNull(),
    itemId: uuid("item_id").notNull(),
    type: reactionTypeEnum("type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.memberId, t.kind, t.itemId, t.type] }),
    index("reactions_item_idx").on(t.kind, t.itemId, t.type),
    index("reactions_member_saved_idx").on(t.memberId, t.type, t.createdAt),
  ],
);
