import { z } from "zod";
import { E164, normalisePhone, PHONE_HINT } from "../domain/phone.js";

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
/**
 * Telephone (D-040): accepts the way people type numbers (024 123 4567, +233 24…, 00233…) and
 * stores E.164 (+233241234567). Use `optionalPhone` for fields that may be left empty.
 */
export const TelephoneSchema = z
  .string()
  .trim()
  .transform((v) => normalisePhone(v))
  .pipe(z.string().regex(E164, PHONE_HINT));

/** Optional phone: empty → null, otherwise tidied and validated like TelephoneSchema. */
export const optionalPhone = () =>
  z
    .string()
    .nullish()
    .transform((v, ctx) => {
      if (v == null || !v.trim()) return null;
      const n = normalisePhone(v);
      if (!E164.test(n)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: PHONE_HINT });
        return z.NEVER;
      }
      return n;
    });
