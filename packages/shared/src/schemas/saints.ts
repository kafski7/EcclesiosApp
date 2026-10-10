import { z } from "zod";
import { CELEBRATION_RANKS, isValidFeast } from "../domain/saints.js";
import { IsoDateSchema } from "./readings.js";

export const CelebrationRankSchema = z.enum(CELEBRATION_RANKS);
export const SaintSlugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lower-case words joined by hyphens")
  .max(80);

export const SaintSummarySchema = z.object({
  slug: SaintSlugSchema,
  name: z.string(),
  /** e.g. "Virgin and Doctor of the Church". */
  title: z.string().nullable(),
  feastMonth: z.number().int(),
  feastDay: z.number().int(),
  rank: CelebrationRankSchema,
  /** One-line description for cards and the feed. */
  summary: z.string(),
  patronage: z.array(z.string()),
  imageUrl: z.string().url().nullable(),
});
export type SaintSummary = z.infer<typeof SaintSummarySchema>;

export const SaintSchema = SaintSummarySchema.extend({
  born: z.string().nullable(),
  died: z.string().nullable(),
  /** Paragraphs. */
  biography: z.array(z.string()),
  source: z.string().nullable(),
});
export type Saint = z.infer<typeof SaintSchema>;

/** GET /api/public/saints/today?date= — client sends its own local date (D-025). */
export const SaintsTodayQuerySchema = z.object({ date: IsoDateSchema.optional() });
export const SaintsTodaySchema = z.object({
  date: IsoDateSchema,
  saint: SaintSummarySchema.nullable(),
  others: z.array(SaintSummarySchema),
});
export type SaintsToday = z.infer<typeof SaintsTodaySchema>;

export const SaintSearchQuerySchema = z.object({
  q: z.string().trim().max(100).default(""),
  month: z.coerce.number().int().min(1).max(12).optional(),
});
export const SaintListSchema = z.object({ items: z.array(SaintSummarySchema) });

/** PUT /api/platform/saints/:slug — Super-Admin maintains the directory. */
export const UpsertSaintSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    title: z.string().trim().max(120).nullable().default(null),
    feastMonth: z.number().int(),
    feastDay: z.number().int(),
    rank: CelebrationRankSchema,
    summary: z.string().trim().min(10).max(280),
    patronage: z.array(z.string().trim().min(2).max(80)).max(20).default([]),
    born: z.string().trim().max(60).nullable().default(null),
    died: z.string().trim().max(60).nullable().default(null),
    biography: z.array(z.string().trim().min(1).max(4000)).min(1).max(30),
    source: z.string().trim().max(200).nullable().default(null),
    isPublished: z.boolean().default(true),
  })
  .refine((s) => isValidFeast(s.feastMonth, s.feastDay), {
    message: "Not a real calendar date",
    path: ["feastDay"],
  });
export type UpsertSaint = z.input<typeof UpsertSaintSchema>;
