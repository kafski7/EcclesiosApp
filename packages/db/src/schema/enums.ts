import { pgEnum } from "drizzle-orm/pg-core";
import {
  COLLECTION_STATUSES,
  CELEBRATION_RANKS,
  ACCESS_LEVELS_MEDIA,
  HIERARCHY_LEVELS,
  MEDIA_KINDS,
  LITURGICAL_COLORS,
  MEMBERSHIP_STATUSES,
  MEMBER_ROLES,
  METROPOLITAN_VISIBILITY,
  PLATFORM_PRIVILEGES,
  PLATFORM_ROLES,
  SUBSCRIPTION_STATUSES,
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
export const membershipStatusEnum = pgEnum("membership_status_enum", MEMBERSHIP_STATUSES);
export const homeTransferStatusEnum = pgEnum("home_transfer_status_enum", [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
]);
export const subscriptionStatusEnum = pgEnum("subscription_status_enum", SUBSCRIPTION_STATUSES);
export const actorTypeEnum = pgEnum("actor_type_enum", ["USER", "MEMBER", "SYSTEM"]);
export const accountingEntityEnum = pgEnum("accounting_entity_enum", [
  "CATEGORY",
  "ACCOUNT",
  "TRANSACTION",
]);
export const liturgicalColorEnum = pgEnum("liturgical_color_enum", LITURGICAL_COLORS);
export const readingKindEnum = pgEnum("reading_kind_enum", ["FIRST", "PSALM", "SECOND", "ALLELUIA", "GOSPEL"]);
export const celebrationRankEnum = pgEnum("celebration_rank_enum", CELEBRATION_RANKS);
export const mediaKindEnum = pgEnum("media_kind_enum", MEDIA_KINDS);
export const mediaAccessEnum = pgEnum("media_access_enum", ACCESS_LEVELS_MEDIA);
