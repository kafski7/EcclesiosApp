import { sql } from "drizzle-orm";
import {
  char,
  check,
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { id, timestamps } from "./_common";
import { accountingEntityEnum, collectionStatusEnum } from "./enums";
import { groups } from "./hierarchy";
import { members } from "./identity";
import { currencies } from "./reference";

/**
 * Thin linkage to the external accounting API (blueprint §7–8).
 * Ecclesios stores references only — never a ledger.
 */
export const externalAccountingRefs = pgTable(
  "external_accounting_refs",
  {
    id: id(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    entityType: accountingEntityEnum("entity_type").notNull(),
    localRef: varchar("local_ref", { length: 100 }).notNull(), // e.g. category code used in the CMS
    externalId: varchar("external_id", { length: 200 }).notNull(),
    provider: varchar("provider", { length: 50 }).notNull(),
    label: varchar("label", { length: 200 }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("ext_refs_external_uq").on(t.provider, t.groupId, t.entityType, t.externalId),
    uniqueIndex("ext_refs_local_uq").on(t.provider, t.groupId, t.entityType, t.localRef),
  ],
);

/**
 * Outstation collections staged for parish approval (blueprint §8.1, D-001).
 * Transitions are enforced by nextCollectionStatus in @ecclesios/shared;
 * the CHECKs below make the invariants impossible to break from SQL too.
 * Invariant enforced app-side: parish_group_id is the outstation's parent.
 */
export const pendingCollections = pgTable(
  "pending_collections",
  {
    id: id(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "restrict" }), // the outstation
    parishGroupId: uuid("parish_group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "restrict" }), // the approver
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    currencyCode: char("currency_code", { length: 3 })
      .notNull()
      .references(() => currencies.code),
    categoryRef: varchar("category_ref", { length: 100 }).notNull(),
    collectedOn: date("collected_on").notNull(),
    note: text("note"),
    status: collectionStatusEnum("status").notNull().default("PENDING"),

    recordedByMemberId: uuid("recorded_by_member_id")
      .notNull()
      .references(() => members.id),
    reviewedByMemberId: uuid("reviewed_by_member_id").references(() => members.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNote: text("review_note"),

    externalTxnId: varchar("external_txn_id", { length: 200 }),
    syncAttempts: integer("sync_attempts").notNull().default(0),
    lastSyncError: text("last_sync_error"),
    syncedAt: timestamp("synced_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    index("pending_collections_queue_idx").on(t.parishGroupId, t.status, t.collectedOn),
    index("pending_collections_group_idx").on(t.groupId, t.collectedOn),
    uniqueIndex("pending_collections_ext_uq")
      .on(t.externalTxnId)
      .where(sql`${t.externalTxnId} IS NOT NULL`),
    check("pc_amount_positive_chk", sql`${t.amount} > 0`),
    check("pc_not_self_chk", sql`${t.groupId} <> ${t.parishGroupId}`),
    check(
      "pc_reviewed_chk",
      sql`${t.status} = 'PENDING' OR (${t.reviewedByMemberId} IS NOT NULL AND ${t.reviewedAt} IS NOT NULL)`,
    ),
    check(
      "pc_reject_note_chk",
      sql`${t.status} <> 'REJECTED' OR length(trim(coalesce(${t.reviewNote}, ''))) >= 3`,
    ),
    check("pc_synced_chk", sql`${t.status} <> 'SYNCED' OR ${t.externalTxnId} IS NOT NULL`),
  ],
);
