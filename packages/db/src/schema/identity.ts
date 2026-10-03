import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { authColumns, id, timestamps } from "./_common";
import { genderEnum, platformPrivilegeEnum, platformRoleEnum } from "./enums";

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
    uniqueIndex("users_email_uq")
      .on(sql`lower(${t.email})`)
      .where(sql`${t.email} IS NOT NULL`),
    uniqueIndex("users_telephone_uq")
      .on(t.telephone)
      .where(sql`${t.telephone} IS NOT NULL`),
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

/**
 * A person (functionality §2.2, §4.2): identity, sign-in and sacramental records.
 * Which churches they belong to, and with what role, is in `memberships` (D-014).
 */
export const members = pgTable(
  "members",
  {
    id: id(),
    /** Account standing. Church membership lives in `memberships` (D-014). */
    isActive: boolean("is_active").notNull().default(true),

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
    index("members_lastname_idx").on(t.lastName),
    // Birthdays module: today's celebrants (joined to memberships per group — functionality §4.3)
    index("members_birthday_idx").on(
      sql`extract(month from ${t.dateOfBirth})`,
      sql`extract(day from ${t.dateOfBirth})`,
    ),
    uniqueIndex("members_email_uq")
      .on(sql`lower(${t.email})`)
      .where(sql`${t.email} IS NOT NULL`),
    uniqueIndex("members_telephone_uq")
      .on(t.telephone)
      .where(sql`${t.telephone} IS NOT NULL`),
  ],
);
