import { pgTable, primaryKey, serial, text, varchar, integer } from "drizzle-orm/pg-core";
import { memberRoleEnum } from "./enums";

/** Church (member) roles only — platform roles are `users.platform_role` (D-003). */
export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  code: memberRoleEnum("code").notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
});

export const permissions = pgTable("permissions", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 100 }).notNull().unique(), // e.g. "members.write"
  module: varchar("module", { length: 50 }).notNull(),
  description: text("description"),
});

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: integer("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionId: integer("permission_id")
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permissionId] })],
);
