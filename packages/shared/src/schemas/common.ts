import { z } from "zod";

/** Standard error envelope every API error must use (Phase 2 error filter). */
export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
    requestId: z.string().optional(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

export const paginated = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    items: z.array(item),
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
  });

export const UuidSchema = z.string().uuid();
/** E.164 telephone, e.g. +233241234567. */
export const TelephoneSchema = z
  .string()
  .regex(/^\+[1-9]\d{7,14}$/, "Use E.164 format, e.g. +233241234567");
