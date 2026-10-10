import { z } from "zod";
import { ACCESS_LEVELS_MEDIA } from "../domain/hymnal.js";
import {
  EPISODE_MEDIA_KINDS,
  EPISODE_STATUSES,
  MAX_ATTACHMENT_BYTES,
  MAX_COVER_BYTES,
  MAX_EPISODE_BYTES,
  MAX_TRANSCRIPT_CHARS,
} from "../domain/podcasts.js";

export const PodcastSlugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(100);
export const EpisodeStatusSchema = z.enum(EPISODE_STATUSES);
export const EpisodeMediaKindSchema = z.enum(EPISODE_MEDIA_KINDS);
export const EpisodeAccessSchema = z.enum(ACCESS_LEVELS_MEDIA);

/** Who a series is by, as shown to listeners. */
export const PodcastPublisherSchema = z.object({
  kind: z.enum(["PLATFORM", "CREATOR", "MEMBER"]),
  name: z.string(),
});

export const PodcastSummarySchema = z.object({
  slug: PodcastSlugSchema,
  title: z.string(),
  summary: z.string(),
  category: z.string().nullable(),
  publisher: PodcastPublisherSchema,
  /** Short-lived presigned URL, or null (initials tile). */
  coverUrl: z.string().url().nullable(),
  episodeCount: z.number().int(),
  latestEpisodeAt: z.string().datetime().nullable(),
});
export type PodcastSummary = z.infer<typeof PodcastSummarySchema>;

export const PodcastSearchQuerySchema = z.object({
  q: z.string().trim().max(100).default(""),
  category: z.string().trim().max(40).optional(),
  page: z.coerce.number().int().min(1).default(1),
});
export const PodcastListSchema = z.object({
  items: z.array(PodcastSummarySchema),
  page: z.number().int(),
  hasMore: z.boolean(),
});

export const EpisodeAttachmentSchema = z.object({ id: z.string().uuid(), label: z.string() });

export const EpisodeSchema = z.object({
  id: z.string().uuid(),
  number: z.number().int().nullable(),
  title: z.string(),
  notes: z.string(),
  durationSec: z.number().int().nullable(),
  publishedAt: z.string().datetime().nullable(),
  /** What the episode leads with (D-029). */
  mediaKind: EpisodeMediaKindSchema,
  hasAudio: z.boolean(),
  /** Set when the caller may watch (YouTube id); null otherwise. */
  youtubeId: z.string().nullable(),
  access: EpisodeAccessSchema,
  /** False when locked behind the listener paywall (D-026/D-029). */
  available: z.boolean(),
  hasTranscript: z.boolean(),
  attachments: z.array(EpisodeAttachmentSchema),
});
export type Episode = z.infer<typeof EpisodeSchema>;

export const PodcastSchema = PodcastSummarySchema.extend({
  description: z.string(),
  episodes: z.array(EpisodeSchema),
});
export type Podcast = z.infer<typeof PodcastSchema>;

export const FollowingPodcastsSchema = z.object({ slugs: z.array(PodcastSlugSchema) });

// ------------------------------------------------------------------ publishing (Super-Admin, creators)

export const UpsertPodcastSchema = z.object({
  title: z.string().trim().min(2).max(160),
  summary: z.string().trim().min(2).max(280),
  description: z.string().trim().max(5000).default(""),
  category: z.string().trim().toLowerCase().max(40).nullable().default(null),
  isPublished: z.boolean().default(true),
});
export type UpsertPodcast = z.infer<typeof UpsertPodcastSchema>;

export const UpsertEpisodeSchema = z.object({
  title: z.string().trim().min(2).max(200),
  notes: z.string().trim().max(10000).default(""),
  number: z.coerce.number().int().min(1).max(9999).nullable().default(null),
  /** Primary media; VIDEO is rejected until a video service exists (D-029). */
  mediaKind: EpisodeMediaKindSchema.default("AUDIO"),
  access: EpisodeAccessSchema.default("FREE"),
  transcript: z.string().trim().max(MAX_TRANSCRIPT_CHARS).default(""),
});
export type UpsertEpisode = z.infer<typeof UpsertEpisodeSchema>;

export const EpisodeUploadSchema = z.object({
  contentType: z.string().max(100),
  bytes: z.number().int().min(1).max(MAX_EPISODE_BYTES, "The file is too large (max 200 MB)."),
});
export const CoverUploadSchema = z.object({
  contentType: z.string().max(100),
  bytes: z.number().int().min(1).max(MAX_COVER_BYTES, "The image is too large (max 5 MB)."),
});
export const AttachAudioSchema = z.object({
  key: z.string().min(5).max(300),
  durationSec: z
    .number()
    .int()
    .min(1)
    .max(24 * 3600)
    .nullable()
    .default(null),
});
/** Set or clear the episode's YouTube / YouTube Music link. */
export const EpisodeYouTubeSchema = z.object({ url: z.string().trim().min(5).max(300).nullable() });
export const AttachmentUploadSchema = z.object({
  contentType: z.string().max(100),
  bytes: z.number().int().min(1).max(MAX_ATTACHMENT_BYTES, "The file is too large (max 20 MB)."),
});
export const AddAttachmentSchema = z.object({
  key: z.string().min(5).max(300),
  label: z.string().trim().min(1).max(80),
});
export const TranscriptSchema = z.object({ text: z.string() });

export const AttachCoverSchema = z.object({ key: z.string().min(5).max(300).nullable() });
export const EpisodeStatusChangeSchema = z.object({ status: EpisodeStatusSchema });

export const StudioEpisodeSchema = EpisodeSchema.extend({
  status: EpisodeStatusSchema,
  audioUrl: z.string().url().nullable(),
  /** The stored link even when the episode is locked (studio always sees it). */
  youtubeId: z.string().nullable(),
  transcript: z.string(),
});
export const StudioPodcastSchema = PodcastSchema.omit({ episodes: true }).extend({
  isPublished: z.boolean(),
  followers: z.number().int(),
  episodes: z.array(StudioEpisodeSchema),
});
export type StudioPodcast = z.infer<typeof StudioPodcastSchema>;
export const StudioPodcastListSchema = z.object({
  items: z.array(
    PodcastSummarySchema.extend({
      isPublished: z.boolean(),
      drafts: z.number().int(),
      followers: z.number().int(),
    }),
  ),
  /** Whether the caller may create a new series. */
  canCreate: z.boolean(),
});
