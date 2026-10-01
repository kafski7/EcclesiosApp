import { pgEnum } from "drizzle-orm/pg-core";
import {
  COLLECTION_STATUSES,
  HIERARCHY_LEVELS,
  MEMBER_ROLES,
  METROPOLITAN_VISIBILITY,
  PLATFORM_PRIVILEGES,
  PLATFORM_ROLES,
} from "@ecclesios/shared/domain";

// DB enums are generated from the shared constants, so TS types and Postgres can't drift.
export const hierarchyLevelEnum = pgEnum("hierarchy_level_enum", HIERARCHY_LEVELS);
export const memberRoleEnum = pgEnum("member_role_enum", MEMBER_ROLES);
export const platformRoleEnum = pgEnum("platform_role_enum", PLATFORM_ROLES);
export const platformPrivilegeEnum = pgEnum("platform_privilege_enum", PLATFORM_PRIVILEGES);
export const metropolitanVisibilityEnum = pgEnum(
  "metropolitan_visibility_enum",
  METROPOLITAN_VISIBILITY,
);
export const collectionStatusEnum = pgEnum("collection_status_enum", COLLECTION_STATUSES);

export const genderEnum = pgEnum("gender_enum", ["MALE", "FEMALE"]);
export const memberStatusEnum = pgEnum("member_status_enum", ["PENDING", "ACTIVE", "INACTIVE"]);
export const subscriptionStatusEnum = pgEnum("subscription_status_enum", [
  "TRIAL",
  "ACTIVE",
  "EXPIRED",
  "CANCELLED",
]);
export const actorTypeEnum = pgEnum("actor_type_enum", ["USER", "MEMBER", "SYSTEM"]);
export const accountingEntityEnum = pgEnum("accounting_entity_enum", [
  "CATEGORY",
  "ACCOUNT",
  "TRANSACTION",
]);
