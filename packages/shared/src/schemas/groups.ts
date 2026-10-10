import { z } from "zod";
import { HierarchyLevelSchema } from "../enums.js";

/** Church groups in Church Management (functionality §4.13, D-041). */
export const GroupChildSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  code: z.string().nullable(),
  level: HierarchyLevelSchema,
  isActive: z.boolean(),
  members: z.number().int(),
  openChildren: z.number().int(),
  /** Hidden from this office by a suffragan diocese's setting (blueprint §3.4). */
  hidden: z.boolean(),
});
export type GroupChild = z.infer<typeof GroupChildSchema>;

export const GroupListSchema = z.object({
  group: z.object({ id: z.string().uuid(), name: z.string(), level: HierarchyLevelSchema }),
  /** The level this office can open under it, if any. */
  childLevel: HierarchyLevelSchema.nullable(),
  canManage: z.boolean(),
  items: z.array(GroupChildSchema),
});
export type GroupList = z.infer<typeof GroupListSchema>;

export const CreateGroupSchema = z.object({
  name: z.string().trim().min(3, "Give it a name").max(200),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{2,50}$/, "Letters, numbers and dashes")
    .nullable()
    .default(null)
    .or(z.literal("").transform(() => null)),
  /** Someone from this church who will run the new group as its Administrator. */
  administratorPersonId: z.string().uuid().nullable().default(null),
});
export type CreateGroup = z.input<typeof CreateGroupSchema>;

export const UpdateGroupSchema = CreateGroupSchema.omit({ administratorPersonId: true });
export type UpdateGroup = z.input<typeof UpdateGroupSchema>;
export const GroupStatusSchema = z.object({ isActive: z.boolean() });
