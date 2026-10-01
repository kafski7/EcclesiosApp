import { z } from "zod";
import {
  COLLECTION_STATUSES,
  HIERARCHY_LEVELS,
  MEMBER_ROLES,
  METROPOLITAN_VISIBILITY,
  PLATFORM_PRIVILEGES,
  PLATFORM_ROLES,
} from "./domain/index.js";

export const HierarchyLevelSchema = z.enum(HIERARCHY_LEVELS);
export const MemberRoleSchema = z.enum(MEMBER_ROLES);
export const PlatformRoleSchema = z.enum(PLATFORM_ROLES);
export const PlatformPrivilegeSchema = z.enum(PLATFORM_PRIVILEGES);
export const MetropolitanVisibilitySchema = z.enum(METROPOLITAN_VISIBILITY);
export const CollectionStatusSchema = z.enum(COLLECTION_STATUSES);
