import { z } from "zod";
import { CollectionStatusSchema } from "../enums.js";

/** Money as a decimal string — never a float (max 2 dp). */
export const MoneySchema = z.string().regex(/^\d{1,12}(\.\d{1,2})?$/, "Amount like 120.50");

export const CreatePendingCollectionSchema = z.object({
  amount: MoneySchema,
  currencyCode: z.string().length(3),
  categoryRef: z.string().min(1).max(100),
  collectedOn: z.string().date(),
  note: z.string().max(500).optional(),
});
export type CreatePendingCollection = z.infer<typeof CreatePendingCollectionSchema>;

export const ReviewPendingCollectionSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("approve"), note: z.string().max(500).optional() }),
  z.object({ decision: z.literal("reject"), note: z.string().min(3).max(500) }),
]);
export type ReviewPendingCollection = z.infer<typeof ReviewPendingCollectionSchema>;

export const PendingCollectionSchema = CreatePendingCollectionSchema.extend({
  id: z.string().uuid(),
  groupId: z.string().uuid(),
  parishGroupId: z.string().uuid(),
  status: CollectionStatusSchema,
  externalTxnId: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type PendingCollection = z.infer<typeof PendingCollectionSchema>;
