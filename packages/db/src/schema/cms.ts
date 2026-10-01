import { sql } from "drizzle-orm";
import {
  boolean,
  char,
  check,
  index,
  inet,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { id, timestamps } from "./_common";
import { actorTypeEnum, subscriptionStatusEnum } from "./enums";
import { groups } from "./hierarchy";
import { members, users } from "./identity";
import { currencies, icons } from "./reference";

/** Societies & clubs; a committee is a society with is_committee = true (functionality §4.4–4.5). */
export const societies = pgTable(
  "societies",
  {
    id: id(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),
    isCommittee: boolean("is_committee").notNull().default(false),
    leaderMemberId: uuid("leader_member_id").references(() => members.id, { onDelete: "set null" }),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps(),
  },
  (t) => [
    index("societies_group_committee_idx").on(t.groupId, t.isCommittee),
    uniqueIndex("societies_group_name_uq").on(t.groupId, sql`lower(${t.name})`),
  ],
);

export const societyMembers = pgTable(
  "society_members",
  {
    societyId: uuid("society_id")
      .notNull()
      .references(() => societies.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    position: varchar("position", { length: 100 }), // e.g. Secretary
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.societyId, t.memberId] }),
    index("society_members_member_idx").on(t.memberId),
  ],
);

/** Ecclesios platform plans (functionality §4.11) — platform billing, not church accounting. */
export const subscriptionTypes = pgTable("subscription_types", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 30 }).notNull().unique(), // BASIC | PREMIUM | ULTIMATE
  name: varchar("name", { length: 100 }).notNull(),
  price: numeric("price", { precision: 12, scale: 2 }).notNull(),
  currencyCode: char("currency_code", { length: 3 })
    .notNull()
    .references(() => currencies.code),
  durationDays: integer("duration_days").notNull(),
  trialDays: integer("trial_days").notNull().default(0),
  smsIncluded: integer("sms_included").notNull().default(0),
  maxMembers: integer("max_members"), // NULL = unlimited
  features: jsonb("features").$type<string[]>().notNull().default([]),
  isActive: boolean("is_active").notNull().default(true),
});

/** Held at parish level, covering its outstations (functionality §6). */
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: id(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "restrict" }),
    subscriptionTypeId: integer("subscription_type_id")
      .notNull()
      .references(() => subscriptionTypes.id),
    status: subscriptionStatusEnum("status").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    smsBalance: integer("sms_balance").notNull().default(0),
    ...timestamps(),
  },
  (t) => [
    index("subscriptions_group_expiry_idx").on(t.groupId, t.expiresAt),
    // At most one live subscription per group.
    uniqueIndex("subscriptions_one_live_uq")
      .on(t.groupId)
      .where(sql`${t.status} IN ('TRIAL','ACTIVE')`),
    check("subscriptions_period_chk", sql`${t.expiresAt} > ${t.startsAt}`),
    check("subscriptions_sms_chk", sql`${t.smsBalance} >= 0`),
  ],
);

export const notificationTypes = pgTable("notification_types", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  iconId: integer("icon_id").references(() => icons.id),
});

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    typeId: integer("type_id")
      .notNull()
      .references(() => notificationTypes.id),
    groupId: uuid("group_id").references(() => groups.id, { onDelete: "cascade" }),
    recipientMemberId: uuid("recipient_member_id").references(() => members.id, {
      onDelete: "cascade",
    }),
    recipientUserId: uuid("recipient_user_id").references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }).notNull(),
    body: text("body"),
    link: text("link"),
    seenAt: timestamp("seen_at", { withTimezone: true }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("notifications_member_unread_idx").on(t.recipientMemberId, t.readAt),
    index("notifications_user_unread_idx").on(t.recipientUserId, t.readAt),
    check(
      "notifications_one_recipient_chk",
      sql`(${t.recipientMemberId} IS NULL) <> (${t.recipientUserId} IS NULL)`,
    ),
  ],
);

/** Append-only (functionality §6). Oversight actions carry the acting group. */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    actorType: actorTypeEnum("actor_type").notNull(),
    actorId: uuid("actor_id"),
    groupId: uuid("group_id").references(() => groups.id, { onDelete: "set null" }),
    action: varchar("action", { length: 100 }).notNull(), // e.g. "collection.approve"
    entityType: varchar("entity_type", { length: 50 }),
    entityId: text("entity_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    ip: inet("ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_logs_group_time_idx").on(t.groupId, t.createdAt),
    index("audit_logs_entity_idx").on(t.entityType, t.entityId),
    index("audit_logs_actor_idx").on(t.actorType, t.actorId),
  ],
);
