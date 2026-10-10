import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { id } from "./_common";
import { notificationTypes, subscriptions } from "./cms";
import {
  messageChannelEnum,
  messageRecipientStatusEnum,
  messageStatusEnum,
  notificationChannelEnum,
} from "./enums";
import { groups } from "./hierarchy";
import { members } from "./identity";

/**
 * A church's SMS / email / in-app message or broadcast (functionality §4.7, D-051).
 * The request only writes this row; a worker expands the audience into message_recipients,
 * charges SMS credit, sends, and refunds what failed.
 */
export const messages = pgTable(
  "messages",
  {
    id: id(),
    /** The sending church. */
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "restrict" }),
    senderMemberId: uuid("sender_member_id").references(() => members.id, { onDelete: "set null" }),
    channel: messageChannelEnum("channel").notNull(),
    subject: varchar("subject", { length: 150 }),
    body: text("body").notNull(),
    /** The audience as composed (shared AudienceSchema), kept for the log. */
    audience: jsonb("audience").$type<Record<string, unknown>>().notNull(),
    audienceLabel: varchar("audience_label", { length: 200 }).notNull(),
    isBroadcast: boolean("is_broadcast").notNull().default(false),
    status: messageStatusEnum("status").notNull().default("QUEUED"),
    /** Short code when the whole message failed (e.g. INSUFFICIENT_SMS_BALANCE). */
    failureReason: varchar("failure_reason", { length: 60 }),
    recipientCount: integer("recipient_count").notNull().default(0),
    sentCount: integer("sent_count").notNull().default(0),
    failedCount: integer("failed_count").notNull().default(0),
    skippedCount: integer("skipped_count").notNull().default(0),
    /** SMS credit taken from `subscriptionId` when sending started, and given back for failures. */
    subscriptionId: uuid("subscription_id").references(() => subscriptions.id, {
      onDelete: "set null",
    }),
    smsCharged: integer("sms_charged").notNull().default(0),
    smsRefunded: integer("sms_refunded").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [
    index("messages_group_time_idx").on(t.groupId, t.createdAt),
    check("messages_sms_chk", sql`${t.smsRefunded} <= ${t.smsCharged}`),
  ],
);

/** One row per person reached — the delivery log. */
export const messageRecipients = pgTable(
  "message_recipients",
  {
    id: id(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    memberId: uuid("member_id").references(() => members.id, { onDelete: "set null" }),
    /** The church they were reached through. */
    groupId: uuid("group_id").references(() => groups.id, { onDelete: "set null" }),
    name: varchar("name", { length: 210 }).notNull(),
    /** For {firstName} when the worker personalises the text. */
    firstName: varchar("first_name", { length: 100 }).notNull(),
    /** Phone (E.164) or email at send time; null for in-app. */
    destination: varchar("destination", { length: 254 }),
    status: messageRecipientStatusEnum("status").notNull().default("PENDING"),
    /** SMS parts charged for this person (0 for email / in-app / skipped). */
    segments: integer("segments").notNull().default(0),
    error: varchar("error", { length: 300 }),
    providerRef: varchar("provider_ref", { length: 120 }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (t) => [
    index("message_recipients_message_status_idx").on(t.messageId, t.status),
    uniqueIndex("message_recipients_message_member_uq")
      .on(t.messageId, t.memberId)
      .where(sql`${t.memberId} IS NOT NULL`),
  ],
);

/**
 * Per-person, per-type, per-channel switch (D-052). No row = on. Checked once, in the
 * notification fan-out worker. In-app only for now; SMS / email / push later.
 */
export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    typeId: integer("type_id")
      .notNull()
      .references(() => notificationTypes.id, { onDelete: "cascade" }),
    channel: notificationChannelEnum("channel").notNull(),
    enabled: boolean("enabled").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.memberId, t.typeId, t.channel] })],
);

/** Once-a-day jobs (birthday digest) claim their day here, so a restart or retry never repeats one. */
export const digestRuns = pgTable(
  "digest_runs",
  {
    kind: varchar("kind", { length: 40 }).notNull(),
    day: date("day").notNull(),
    ranAt: timestamp("ran_at", { withTimezone: true }).notNull().defaultNow(),
    notified: integer("notified").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.kind, t.day] })],
);

export type MessageRow = typeof messages.$inferSelect;
export type MessageRecipientRow = typeof messageRecipients.$inferSelect;
