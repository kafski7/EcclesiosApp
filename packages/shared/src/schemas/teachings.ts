import { z } from "zod";
import { TEACHING_STATUSES } from "../domain/teachings.js";

export const TeachingSlugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100);
export const TopicSlugSchema = TeachingSlugSchema;
export const TeachingStatusSchema = z.enum(TEACHING_STATUSES);

/** GET /api/public/teachings/topics (D-030). */
export const TeachingTopicSchema = z.object({
  slug: TopicSlugSchema,
  name: z.string(),
  description: z.string(),
  teachingCount: z.number().int(),
});
export type TeachingTopic = z.infer<typeof TeachingTopicSchema>;
export const TeachingTopicListSchema = z.object({ items: z.array(TeachingTopicSchema) });

export const TeachingSummarySchema = z.object({
  /** For likes / saves (D-035). */
  id: z.string().uuid(),
  slug: TeachingSlugSchema,
  title: z.string(),
  summary: z.string(),
  topics: z.array(z.object({ slug: TopicSlugSchema, name: z.string() })),
  readingMinutes: z.number().int(),
  publishedAt: z.string().datetime().nullable(),
});
export type TeachingSummary = z.infer<typeof TeachingSummarySchema>;

export const TeachingSearchQuerySchema = z.object({
  q: z.string().trim().max(100).default(""),
  topic: TopicSlugSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
});
export const TeachingListSchema = z.object({
  items: z.array(TeachingSummarySchema),
  page: z.number().int(),
  hasMore: z.boolean(),
});

/** Lesson source in the D-030 text format; clients render it with parseLesson. */
export const TeachingSchema = TeachingSummarySchema.extend({
  body: z.string(),
  /** e.g. "Reviewed by Rev. Fr. …" — shown under the lesson. */
  reviewedBy: z.string().nullable(),
  source: z.string().nullable(),
  /** Explicit links first, then others on the same topic. */
  related: z.array(TeachingSummarySchema),
});
export type Teaching = z.infer<typeof TeachingSchema>;

// ------------------------------------------------------------------ Super-Admin

export const UpsertTopicSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(400).default(""),
  position: z.number().int().min(0).max(999).default(0),
});
export type UpsertTopic = z.input<typeof UpsertTopicSchema>;

export const UpsertTeachingSchema = z.object({
  title: z.string().trim().min(3).max(160),
  summary: z.string().trim().min(10).max(300),
  body: z.string().trim().min(20).max(60_000),
  topics: z.array(TopicSlugSchema).min(1, "Choose at least one topic").max(5),
  /** Slugs of teachings to show as "Related". Links written in the body are added automatically. */
  related: z.array(TeachingSlugSchema).max(10).default([]),
  reviewedBy: z.string().trim().max(160).nullable().default(null),
  source: z.string().trim().max(200).nullable().default(null),
});
export type UpsertTeaching = z.input<typeof UpsertTeachingSchema>;

export const TeachingStatusChangeSchema = z.object({ status: TeachingStatusSchema });

export const AdminTeachingRowSchema = TeachingSummarySchema.extend({ status: TeachingStatusSchema, updatedAt: z.string().datetime() });
export const AdminTeachingListSchema = z.object({ items: z.array(AdminTeachingRowSchema) });
export const AdminTeachingSchema = TeachingSchema.extend({
  status: TeachingStatusSchema,
  relatedSlugs: z.array(TeachingSlugSchema),
  /** Problems to fix before publishing (lintLesson). */
  problems: z.array(z.string()),
});
export type AdminTeaching = z.infer<typeof AdminTeachingSchema>;
