import { z } from "zod";
import {
  BOOK_CATEGORIES,
  BOOK_FORMATS,
  BOOK_STATUSES,
  MAX_BOOK_BYTES,
  MAX_COMMISSION_BPS,
  MAX_PRICE_MINOR,
  MIN_PAID_PRICE_MINOR,
  ORDER_STATUSES,
  REFUND_STATUSES,
} from "../domain/books.js";

export const BookSlugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(120);
export const BookStatusSchema = z.enum(BOOK_STATUSES);
export const BookFormatSchema = z.enum(BOOK_FORMATS);
export const BookCategorySchema = z.enum(BOOK_CATEGORIES);
export const OrderStatusSchema = z.enum(ORDER_STATUSES);
export const RefundStatusSchema = z.enum(REFUND_STATUSES);

const PriceSchema = z
  .number()
  .int()
  .min(0)
  .max(MAX_PRICE_MINOR)
  .refine((p) => p === 0 || p >= MIN_PAID_PRICE_MINOR, "Paid books cost at least GHS 1.00");

/** Catalogue card (D-036). */
export const BookSummarySchema = z.object({
  id: z.string().uuid(),
  slug: BookSlugSchema,
  title: z.string(),
  subtitle: z.string().nullable(),
  authorName: z.string(),
  category: BookCategorySchema,
  coverUrl: z.string().url().nullable(),
  priceMinor: z.number().int(),
  currency: z.string(),
  format: BookFormatSchema,
  /** The signed-in member owns it (bought or added free). */
  owned: z.boolean(),
});
export type BookSummary = z.infer<typeof BookSummarySchema>;

export const BookQuerySchema = z.object({
  q: z.string().trim().max(100).default(""),
  category: BookCategorySchema.optional(),
  price: z.enum(["free", "paid"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
});
export const BookListSchema = z.object({
  items: z.array(BookSummarySchema),
  page: z.number().int(),
  hasMore: z.boolean(),
});

export const BookSchema = BookSummarySchema.extend({
  description: z.string(),
  aboutAuthor: z.string(),
  language: z.string(),
  pages: z.number().int().nullable(),
  isbn: z.string().nullable(),
  /** "Nihil obstat: … · Imprimatur: …" where the book has them. */
  approbation: z.string().nullable(),
  publishedAt: z.string().datetime().nullable(),
  hasPreview: z.boolean(),
  /** Set for the buyer: their latest paid order, for refunds. */
  order: z
    .object({
      id: z.string().uuid(),
      paidAt: z.string().datetime(),
      refund: z.object({
        allowed: z.boolean(),
        reason: z.string().nullable(),
        status: RefundStatusSchema.nullable(),
      }),
    })
    .nullable(),
});
export type Book = z.infer<typeof BookSchema>;

/** Short-lived URL to read the full book (owners, free books) or its preview. */
export const ReadUrlSchema = z.object({
  url: z.string().url(),
  format: BookFormatSchema,
  expiresInSeconds: z.number().int(),
  /** Shown faintly on the page (light copy protection). */
  watermark: z.string().nullable(),
  progress: z.object({ locator: z.string().nullable(), percent: z.number().int() }),
  preview: z.boolean(),
});
export type ReadUrl = z.infer<typeof ReadUrlSchema>;

export const ProgressSchema = z.object({
  locator: z.string().max(500).nullable(),
  percent: z.number().int().min(0).max(100),
});

export const LibraryItemSchema = BookSummarySchema.extend({
  percent: z.number().int(),
  addedAt: z.string().datetime(),
  lastReadAt: z.string().datetime().nullable(),
});
export const LibrarySchema = z.object({ items: z.array(LibraryItemSchema) });

// ------------------------------------------------------------------ checkout

export const CheckoutResponseSchema = z.object({
  orderId: z.string().uuid(),
  /** Hubtel's hosted checkout (or the development test page). */
  checkoutUrl: z.string().url(),
});
export const OrderSchema = z.object({
  id: z.string().uuid(),
  status: OrderStatusSchema,
  amountMinor: z.number().int(),
  currency: z.string(),
  book: z.object({ slug: z.string(), title: z.string() }),
  createdAt: z.string().datetime(),
  paidAt: z.string().datetime().nullable(),
});
export type Order = z.infer<typeof OrderSchema>;
export const RefundRequestSchema = z.object({
  reason: z.string().trim().min(5, "Tell us briefly why").max(500),
});

// ------------------------------------------------------------------ studio (sellers)

export const UpsertBookSchema = z.object({
  title: z.string().trim().min(2).max(200),
  subtitle: z.string().trim().max(200).nullable().default(null),
  authorName: z.string().trim().min(2).max(160),
  description: z.string().trim().max(6000).default(""),
  aboutAuthor: z.string().trim().max(3000).default(""),
  category: BookCategorySchema,
  language: z.string().trim().min(2).max(10).default("en"),
  pages: z.number().int().min(1).max(10000).nullable().default(null),
  isbn: z.string().trim().max(20).nullable().default(null),
  approbation: z.string().trim().max(300).nullable().default(null),
  priceMinor: PriceSchema,
  rightsConfirmed: z.boolean().default(false),
});
export type UpsertBook = z.input<typeof UpsertBookSchema>;
/** On a PUBLISHED book only these can change (D-036). */
export const BookPriceSchema = z.object({ priceMinor: PriceSchema });

export const BookUploadSchema = z.object({
  part: z.enum(["file", "preview", "cover"]),
  contentType: z.string().max(100),
  bytes: z.number().int().min(1).max(MAX_BOOK_BYTES),
});
export const AttachBookFileSchema = z.object({
  part: z.enum(["file", "preview", "cover"]),
  key: z.string().min(5).max(300).nullable(),
});

export const StudioBookSchema = BookSchema.omit({ owned: true, order: true }).extend({
  status: BookStatusSchema,
  reviewNote: z.string().nullable(),
  rightsConfirmed: z.boolean(),
  hasFile: z.boolean(),
  problems: z.array(z.string()),
  sold: z.number().int(),
  earnedMinor: z.number().int(),
  seller: z.string(),
  updatedAt: z.string().datetime(),
});
export type StudioBook = z.infer<typeof StudioBookSchema>;
export const StudioBookListSchema = z.object({
  items: z.array(StudioBookSchema),
  canCreate: z.boolean(),
});

export const SellerStatementSchema = z.object({
  commissionBps: z.number().int(),
  earnedMinor: z.number().int(),
  refundedMinor: z.number().int(),
  paidOutMinor: z.number().int(),
  balanceMinor: z.number().int(),
  sales: z.array(
    z.object({
      orderId: z.string().uuid(),
      book: z.string(),
      at: z.string().datetime(),
      priceMinor: z.number().int(),
      authorMinor: z.number().int(),
      status: OrderStatusSchema,
    }),
  ),
  payouts: z.array(
    z.object({
      id: z.string().uuid(),
      amountMinor: z.number().int(),
      reference: z.string(),
      at: z.string().datetime(),
    }),
  ),
});
export type SellerStatement = z.infer<typeof SellerStatementSchema>;

// ------------------------------------------------------------------ platform (Super-Admin)

export const BookDecisionSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("approve"), note: z.string().trim().max(500).optional() }),
  z.object({
    decision: z.literal("reject"),
    note: z.string().trim().min(3, "Tell the seller why").max(500),
  }),
  z.object({
    decision: z.literal("unlist"),
    note: z.string().trim().min(3, "Give a reason").max(500),
  }),
]);
export type BookDecision = z.infer<typeof BookDecisionSchema>;

export const BookSettingsSchema = z.object({
  /** Platform-wide commission in basis points (2000 = 20 %). */
  commissionBps: z.number().int().min(0).max(MAX_COMMISSION_BPS),
});

export const SellerRowSchema = z.object({
  /** "user:<id>" or "member:<id>". */
  key: z.string(),
  name: z.string(),
  books: z.number().int(),
  commissionBps: z.number().int().nullable(),
  balanceMinor: z.number().int(),
  payoutTo: z.string().nullable(),
});
export const SellerListSchema = z.object({
  items: z.array(SellerRowSchema),
  defaultCommissionBps: z.number().int(),
});
export const SellerTermsSchema = z.object({
  commissionBps: z.number().int().min(0).max(MAX_COMMISSION_BPS).nullable(),
  /** Mobile-money number or bank details for payouts. */
  payoutTo: z.string().trim().max(200).nullable(),
});
export const RecordPayoutSchema = z.object({
  amountMinor: z.number().int().min(1),
  reference: z.string().trim().min(3, "Add the transfer reference").max(120),
});

export const RefundRowSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  book: z.string(),
  buyer: z.string(),
  amountMinor: z.number().int(),
  reason: z.string(),
  status: RefundStatusSchema,
  percentRead: z.number().int(),
  paidAt: z.string().datetime().nullable(),
  requestedAt: z.string().datetime(),
});
export const RefundListSchema = z.object({ items: z.array(RefundRowSchema) });
export const RefundDecisionSchema = z.object({
  decision: z.enum(["approve", "decline"]),
  /** Hubtel transfer reference for the money sent back (approve) or the reason (decline). */
  note: z.string().trim().min(3).max(300),
});
/** Super-Admin refund of any paid order (e.g. a broken file). */
export const AdminRefundSchema = z.object({ note: z.string().trim().min(3).max(300) });
