import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { authColumns, id, timestamps } from "./_common";
import { genderEnum, memberStatusEnum, platformPrivilegeEnum, platformRoleEnum } from "./enums";
import { groups } from "./hierarchy";
import { roles } from "./rbac";

/** Platform accounts: Super-Admins and Creators (functionality §2.1). */
export const users = pgTable(
  "users",
  {
    id: id(),
    fullName: varchar("full_name", { length: 200 }).notNull(),
    email: varchar("email", { length: 254 }),
    telephone: varchar("telephone", { length: 20 }),
    passwordHash: text("password_hash").notNull(),
    platformRole: platformRoleEnum("platform_role").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    ...authColumns(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("users_email_uq").on(sql`lower(${t.email})`).where(sql`${t.email} IS NOT NULL`),
    uniqueIndex("users_telephone_uq").on(t.telephone).where(sql`${t.telephone} IS NOT NULL`),
  ],
);

export const userPrivileges = pgTable(
  "user_privileges",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    privilege: platformPrivilegeEnum("privilege").notNull(),
    grantedByUserId: uuid("granted_by_user_id").references(() => users.id),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.privilege] })],
);

/** Church people at any hierarchy level (functionality §2.2, §4.2). */
export const members = pgTable(
  "members",
  {
    id: id(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "restrict" }),
    roleId: integer("role_id")
      .notNull()
      .references(() => roles.id),
    status: memberStatusEnum("status").notNull().default("ACTIVE"),

    // personal
    firstName: varchar("first_name", { length: 100 }).notNull(),
    otherNames: varchar("other_names", { length: 100 }),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    gender: genderEnum("gender"),
    dateOfBirth: date("date_of_birth"),
    email: varchar("email", { length: 254 }),
    telephone: varchar("telephone", { length: 20 }),
    address: text("address"),
    occupation: varchar("occupation", { length: 150 }),
    photoKey: text("photo_key"), // object-storage key, never a binary

    // sacramental records
    isBaptised: boolean("is_baptised").notNull().default(false),
    baptismDate: date("baptism_date"),
    baptismPlace: varchar("baptism_place", { length: 200 }),
    isCommunicant: boolean("is_communicant").notNull().default(false),
    firstCommunionDate: date("first_communion_date"),
    isConfirmed: boolean("is_confirmed").notNull().default(false),
    confirmationDate: date("confirmation_date"),
    isDeceased: boolean("is_deceased").notNull().default(false),
    deceasedOn: date("deceased_on"),

    // login (optional — not every member logs in)
    passwordHash: text("password_hash"),
    ...authColumns(),
    ...timestamps(),
  },
  (t) => [
    index("members_group_idx").on(t.groupId),
    index("members_group_status_idx").on(t.groupId, t.status),
    index("members_group_lastname_idx").on(t.groupId, t.lastName),
    // Birthdays module: today's celebrants per group (functionality §4.3)
    index("members_group_birthday_idx").on(
      t.groupId,
      sql`extract(month from ${t.dateOfBirth})`,
      sql`extract(day from ${t.dateOfBirth})`,
    ),
    uniqueIndex("members_email_uq").on(sql`lower(${t.email})`).where(sql`${t.email} IS NOT NULL`),
    uniqueIndex("members_telephone_uq").on(t.telephone).where(sql`${t.telephone} IS NOT NULL`),
  ],
);
