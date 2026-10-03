import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { id, timestamps } from "./_common";
import { homeTransferStatusEnum, membershipStatusEnum, platformPrivilegeEnum } from "./enums";
import { groups } from "./hierarchy";
import { members, users } from "./identity";
import { roles } from "./rbac";

/**
 * A person's membership of a church, with its own role and status (D-014).
 * Only ACTIVE memberships grant church-scoped access (D-015). One HOME per person (D-016).
 */
export const memberships = pgTable(
  "memberships",
  {
    id: id(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "restrict" }),
    roleId: integer("role_id")
      .notNull()
      .references(() => roles.id),
    status: membershipStatusEnum("status").notNull().default("PENDING"),
    isHome: boolean("is_home").notNull().default(false),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    decidedByMemberId: uuid("decided_by_member_id").references(() => members.id, {
      onDelete: "set null",
    }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decisionNote: text("decision_note"),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("memberships_member_group_uq").on(t.memberId, t.groupId),
    uniqueIndex("memberships_one_home_uq")
      .on(t.memberId)
      .where(sql`${t.isHome}`),
    index("memberships_group_status_idx").on(t.groupId, t.status),
    index("memberships_member_status_idx").on(t.memberId, t.status),
    check("memberships_home_live_chk", sql`NOT ${t.isHome} OR ${t.status} IN ('PENDING','ACTIVE')`),
    check(
      "memberships_decided_chk",
      sql`${t.status} NOT IN ('ACTIVE','REJECTED') OR ${t.decidedAt} IS NOT NULL`,
    ),
  ],
);

/** Following a church: one tap, no approval, public content only (D-015). */
export const follows = pgTable(
  "follows",
  {
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.memberId, t.groupId] }),
    index("follows_group_idx").on(t.groupId),
  ],
);

/**
 * Moving a person's home church (and with it, edit rights on their sacramental records).
 * Decided by the receiving church (or its parish); the previous home is notified (D-016).
 */
export const homeTransfers = pgTable(
  "home_transfers",
  {
    id: id(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    fromGroupId: uuid("from_group_id").references(() => groups.id, { onDelete: "set null" }),
    toGroupId: uuid("to_group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "restrict" }),
    status: homeTransferStatusEnum("status").notNull().default("PENDING"),
    reason: text("reason"),
    decidedByMemberId: uuid("decided_by_member_id").references(() => members.id, {
      onDelete: "set null",
    }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decisionNote: text("decision_note"),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("home_transfers_one_open_uq")
      .on(t.memberId)
      .where(sql`${t.status} = 'PENDING'`),
    index("home_transfers_to_status_idx").on(t.toGroupId, t.status),
    check("home_transfers_not_same_chk", sql`${t.fromGroupId} IS DISTINCT FROM ${t.toGroupId}`),
  ],
);

/**
 * Content-creator and podcast grants for members (D-017), mirroring `user_privileges`.
 * Granted by a Super-Admin after the member applies.
 */
export const memberPrivileges = pgTable(
  "member_privileges",
  {
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    privilege: platformPrivilegeEnum("privilege").notNull(),
    grantedByUserId: uuid("granted_by_user_id").references(() => users.id),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.memberId, t.privilege] })],
);
