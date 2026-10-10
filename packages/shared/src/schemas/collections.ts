import { z } from "zod";
import { COLLECTION_CATEGORIES } from "../domain/collections.js";
import { CollectionStatusSchema } from "../enums.js";

/** Money as a decimal string — never a float (max 2 dp). */
export const MoneySchema = z
  .string()
  .trim()
  .regex(/^\d{1,12}(\.\d{1,2})?$/, "Amount like 120.50")
  .refine((v) => Number(v) > 0, "Enter an amount above zero");

export const CollectionCategorySchema = z.enum(COLLECTION_CATEGORIES);

/** Outstation staff record a collection (D-041). Currency is the church's; the date defaults to today. */
export const RecordCollectionSchema = z.object({
  amount: MoneySchema,
  categoryRef: CollectionCategorySchema,
  collectedOn: z.string().date("Use YYYY-MM-DD").optional(),
  note: z.string().trim().max(500).nullable().default(null),
});
export type RecordCollection = z.input<typeof RecordCollectionSchema>;

export const ReviewPendingCollectionSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("approve"), note: z.string().trim().max(500).optional() }),
  z.object({ decision: z.literal("reject"), note: z.string().trim().min(3, "Say why").max(500) }),
]);
export type ReviewPendingCollection = z.infer<typeof ReviewPendingCollectionSchema>;

export const CollectionsQuerySchema = z.object({
  status: CollectionStatusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
});

const Ref = z.object({ id: z.string().uuid(), name: z.string() });
export const CollectionRowSchema = z.object({
  id: z.string().uuid(),
  outstation: Ref,
  amount: z.string(),
  currencyCode: z.string(),
  categoryRef: z.string(),
  collectedOn: z.string(),
  note: z.string().nullable(),
  status: CollectionStatusSchema,
  recordedBy: z.string(),
  reviewedBy: z.string().nullable(),
  reviewedAt: z.string().datetime().nullable(),
  reviewNote: z.string().nullable(),
  externalTxnId: z.string().nullable(),
  lastSyncError: z.string().nullable(),
  createdAt: z.string().datetime(),
  can: z.object({ edit: z.boolean(), review: z.boolean(), retry: z.boolean() }),
});
export type CollectionRow = z.infer<typeof CollectionRowSchema>;

export const CollectionListSchema = z.object({
  items: z.array(CollectionRowSchema),
  page: z.number().int(),
  hasMore: z.boolean(),
  /** Waiting for the parish, with their total. */
  pending: z.object({ count: z.number().int(), total: z.string() }),
  /** OUTSTATION: records its own; PARISH: reviews its outstations'. */
  mode: z.enum(["RECORD", "REVIEW"]),
  currencyCode: z.string(),
  allowBackdating: z.boolean(),
});
export type CollectionList = z.infer<typeof CollectionListSchema>;

const Totals = z.object({
  total: z.string(),
  byCategory: z.array(z.object({ categoryRef: z.string(), total: z.string() })),
});
/** Read-only figures from the accounting service (D-041). */
export const FinanceSummarySchema = z.object({
  connected: z.boolean(),
  provider: z.string().nullable(),
  currencyCode: z.string(),
  month: Totals,
  year: Totals,
  awaitingApproval: z.object({ count: z.number().int(), total: z.string() }),
  failedSync: z.number().int(),
});
export type FinanceSummary = z.infer<typeof FinanceSummarySchema>;
