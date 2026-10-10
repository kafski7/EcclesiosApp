import { z } from "zod";
import { ACCESS_LEVELS_MEDIA, MEDIA_KINDS } from "../domain/hymnal.js";

export const MediaKindSchema = z.enum(MEDIA_KINDS);
export const MediaAccessSchema = z.enum(ACCESS_LEVELS_MEDIA);
export const HymnSlugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(100);
export const BookCodeSchema = z.string().regex(/^[A-Z0-9]{1,10}$/, "Upper-case code, e.g. NCH");
const HymnNumberSchema = z
  .string()
  .trim()
  .regex(/^\d{1,4}[a-zA-Z]?$/, "A number like 512 or 246a");

/** GET /api/public/hymnal/books (D-026). */
export const HymnBookSchema = z.object({
  code: BookCodeSchema,
  name: z.string(),
  /** ISO 3166 alpha-2, e.g. GH. Null = international. */
  country: z.string().nullable(),
  publisher: z.string().nullable(),
  hymnCount: z.number().int(),
});
export type HymnBook = z.infer<typeof HymnBookSchema>;
export const HymnBookListSchema = z.object({ items: z.array(HymnBookSchema) });

export const BookNumberSchema = z.object({
  book: BookCodeSchema,
  bookName: z.string(),
  number: z.string(),
});
export type BookNumber = z.infer<typeof BookNumberSchema>;

export const HymnSummarySchema = z.object({
  /** For likes / saves (D-035). */
  id: z.string().uuid(),
  slug: HymnSlugSchema,
  title: z.string(),
  firstLine: z.string(),
  /** Reader's country first (D-026). */
  numbers: z.array(BookNumberSchema),
  tags: z.array(z.string()),
  hasAudio: z.boolean(),
  hasNotation: z.boolean(),
});
export type HymnSummary = z.infer<typeof HymnSummarySchema>;

export const HymnSearchQuerySchema = z.object({
  q: z.string().trim().max(100).default(""),
  book: BookCodeSchema.optional(),
  tag: z.string().trim().max(50).optional(),
  /** ISO country of the reader, to order book numbers. */
  country: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
});
export const HymnListSchema = z.object({
  items: z.array(HymnSummarySchema),
  page: z.number().int(),
  hasMore: z.boolean(),
  /** Set when the query was a hymn number (e.g. "NCH 512"). */
  matchedNumber: z.object({ book: z.string().nullable(), number: z.string() }).nullable(),
});

export const VerseSchema = z.object({
  /** "1", "2", "R" (refrain) … */
  label: z.string().max(8),
  lines: z.array(z.string().max(300)).min(1).max(30),
});
export type Verse = z.infer<typeof VerseSchema>;

export const HymnMediaSchema = z.object({
  id: z.string().uuid(),
  kind: MediaKindSchema,
  /** e.g. "Piano", "Choir", "Voice". */
  label: z.string(),
  access: MediaAccessSchema,
  isDefault: z.boolean(),
  /** False when the caller may not open it (paywall on, not subscribed). UI shows a lock. */
  available: z.boolean(),
  /** YouTube video id (kind YOUTUBE, when available). Files are opened via the media URL endpoint. */
  youtubeId: z.string().nullable(),
  durationSec: z.number().int().nullable(),
});
export type HymnMedia = z.infer<typeof HymnMediaSchema>;

export const HymnTuneSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  composer: z.string().nullable(),
  meter: z.string().nullable(),
  isDefault: z.boolean(),
  media: z.array(HymnMediaSchema),
});
export type HymnTune = z.infer<typeof HymnTuneSchema>;

export const HymnSchema = HymnSummarySchema.extend({
  author: z.string().nullable(),
  verses: z.array(VerseSchema),
  tunes: z.array(HymnTuneSchema),
  source: z.string().nullable(),
});
export type Hymn = z.infer<typeof HymnSchema>;

/** GET /api/public/hymnal/media/:id/url — short-lived download/stream URL. */
export const MediaUrlSchema = z.object({
  url: z.string().url(),
  expiresInSeconds: z.number().int(),
});

// ------------------------------------------------------------------ Super-Admin

export const UpsertHymnSchema = z.object({
  title: z.string().trim().max(200).nullable().default(null),
  firstLine: z.string().trim().min(2).max(300),
  author: z.string().trim().max(200).nullable().default(null),
  verses: z.array(VerseSchema).min(1).max(40),
  numbers: z
    .array(z.object({ book: BookCodeSchema, number: HymnNumberSchema }))
    .max(10)
    .default([]),
  tags: z.array(z.string().trim().toLowerCase().min(2).max(50)).max(20).default([]),
  source: z.string().trim().max(200).nullable().default(null),
  isPublished: z.boolean().default(true),
});
export type UpsertHymn = z.input<typeof UpsertHymnSchema>;

export const UpsertTuneSchema = z.object({
  name: z.string().trim().min(1).max(120),
  composer: z.string().trim().max(200).nullable().default(null),
  meter: z.string().trim().max(40).nullable().default(null),
  isDefault: z.boolean().default(false),
});
export type UpsertTune = z.input<typeof UpsertTuneSchema>;

/** Step 1 of an upload: ask for a presigned PUT URL. */
export const PresignUploadSchema = z.object({
  kind: MediaKindSchema.exclude(["YOUTUBE"]),
  contentType: z.string().max(100),
  bytes: z.number().int().min(1),
  fileName: z.string().trim().min(1).max(200),
});
export const PresignedUploadSchema = z.object({
  key: z.string(),
  url: z.string().url(),
  /** Headers the client must send with the PUT. */
  headers: z.record(z.string()),
  expiresInSeconds: z.number().int(),
});
export type PresignedUpload = z.infer<typeof PresignedUploadSchema>;

/** Step 2: register the uploaded object (or a YouTube link) on a tune. */
export const AddMediaSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.enum(["AUDIO", "MIDI", "STAFF_PDF", "SOLFA_PDF"]),
    key: z.string().min(5).max(300),
    label: z.string().trim().min(1).max(60),
    access: MediaAccessSchema.optional(),
    isDefault: z.boolean().default(false),
    durationSec: z.number().int().min(1).max(3600).nullable().default(null),
  }),
  z.object({
    kind: z.literal("YOUTUBE"),
    url: z.string().trim().min(5).max(300),
    label: z.string().trim().min(1).max(60),
    access: MediaAccessSchema.optional(),
    isDefault: z.boolean().default(false),
  }),
]);
export type AddMedia = z.input<typeof AddMediaSchema>;

export const UpdateMediaSchema = z.object({
  label: z.string().trim().min(1).max(60).optional(),
  access: MediaAccessSchema.optional(),
  isDefault: z.boolean().optional(),
});

/** Admin list row (includes unpublished). */
export const AdminHymnRowSchema = z.object({
  slug: HymnSlugSchema,
  title: z.string(),
  numbers: z.array(BookNumberSchema),
  tunes: z.number().int(),
  media: z.number().int(),
  isPublished: z.boolean(),
});
export const AdminHymnListSchema = z.object({ items: z.array(AdminHymnRowSchema) });

/** Admin detail = public detail + editable fields. */
export const AdminHymnSchema = HymnSchema.extend({
  isPublished: z.boolean(),
  tunes: z.array(
    HymnTuneSchema.extend({
      media: z.array(
        HymnMediaSchema.extend({ key: z.string().nullable(), url: z.string().nullable() }),
      ),
    }),
  ),
});
export type AdminHymn = z.infer<typeof AdminHymnSchema>;

export const HYMNAL_ERROR_CODES = [
  "HYMN_NOT_FOUND",
  "BOOK_NOT_FOUND",
  "NUMBER_TAKEN",
  "TUNE_NOT_FOUND",
  "MEDIA_NOT_FOUND",
  "MEDIA_LOCKED",
  "UPLOAD_REJECTED",
  "INVALID_YOUTUBE_LINK",
] as const;
