import { z } from "zod";
import { NEWS_CATEGORIES, NEWS_STATUSES } from "../domain/news.js";

export const NewsSlugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(100);
export const NewsStatusSchema = z.enum(NEWS_STATUSES);
export const NewsCategorySchema = z.enum(NEWS_CATEGORIES);

/** GET /api/public/news (D-032). */
export const NewsSummarySchema = z.object({
  slug: NewsSlugSchema,
  title: z.string(),
  summary: z.string(),
  category: NewsCategorySchema,
  pinned: z.boolean(),
  coverUrl: z.string().url().nullable(),
  publishedAt: z.string().datetime(),
});
export type NewsSummary = z.infer<typeof NewsSummarySchema>;

export const NewsQuerySchema = z.object({
  category: NewsCategorySchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
});
export const NewsListSchema = z.object({
  items: z.array(NewsSummarySchema),
  page: z.number().int(),
  hasMore: z.boolean(),
});

/** One item: body in the lesson format (D-030), optional call-to-action link. */
export const NewsItemSchema = NewsSummarySchema.extend({
  body: z.string(),
  link: z.object({ url: z.string().url(), label: z.string() }).nullable(),
});
export type NewsItem = z.infer<typeof NewsItemSchema>;

// ------------------------------------------------------------------ Super-Admin

export const UpsertNewsSchema = z
  .object({
    title: z.string().trim().min(3).max(140),
    summary: z.string().trim().min(10).max(280),
    body: z.string().trim().max(20_000).default(""),
    category: NewsCategorySchema.default("ANNOUNCEMENT"),
    pinned: z.boolean().default(false),
    linkUrl: z.string().trim().url().max(500).nullable().default(null),
    linkLabel: z.string().trim().max(40).nullable().default(null),
    /** Only for items already published or scheduled: move the publish time. */
    publishAt: z.string().datetime().nullable().default(null),
    /** Leaves Home and the rail after this; the page stays readable. */
    expiresAt: z.string().datetime().nullable().default(null),
  })
  .refine((v) => !v.publishAt || !v.expiresAt || v.expiresAt > v.publishAt, {
    message: "Must be after the publish time",
    path: ["expiresAt"],
  })
  .refine((v) => !v.linkLabel || v.linkUrl, {
    message: "Add the link's address",
    path: ["linkUrl"],
  });
export type UpsertNews = z.input<typeof UpsertNewsSchema>;

/** Publish now, schedule (publishAt in the future), or back to draft. */
export const NewsStatusChangeSchema = z.object({
  status: NewsStatusSchema,
  publishAt: z.string().datetime().nullable().default(null),
});

export const AdminNewsSchema = NewsItemSchema.extend({
  status: NewsStatusSchema,
  publishedAt: z.string().datetime().nullable(),
  expiresAt: z.string().datetime().nullable(),
  /** Live state for the console: draft, scheduled, live, expired. */
  state: z.enum(["DRAFT", "SCHEDULED", "LIVE", "EXPIRED"]),
  problems: z.array(z.string()),
  updatedAt: z.string().datetime(),
});
export type AdminNews = z.infer<typeof AdminNewsSchema>;
export const AdminNewsListSchema = z.object({
  items: z.array(AdminNewsSchema.omit({ body: true, problems: true })),
});

/** Pick a hymn of the day for a date (D-033). */
export const PinHymnSchema = z.object({
  hymnSlug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(100)
    .nullable(),
});
