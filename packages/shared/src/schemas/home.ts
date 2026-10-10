import { z } from "zod";
import { FEED_ITEM_TYPES, WATCH_KINDS } from "../domain/home.js";
import { LITURGICAL_COLORS, LITURGICAL_SEASONS } from "../domain/liturgy.js";
import { PostSummarySchema } from "./explore.js";
import { NewsSummarySchema } from "./news.js";
import { IsoDateSchema } from "./readings.js";
import { SaintSummarySchema } from "./saints.js";
import { TeachingSummarySchema } from "./teachings.js";

export const HomeQuerySchema = z.object({ date: IsoDateSchema.optional() });

/** Hymn of the day (D-033): enough for a rail card. */
export const HymnOfDaySchema = z.object({
  slug: z.string(),
  title: z.string(),
  firstLine: z.string(),
  numbers: z.array(z.object({ book: z.string(), number: z.string() })),
  /** First lines of the opening verse, for the card. */
  excerpt: z.array(z.string()),
  hasAudio: z.boolean(),
  pinned: z.boolean(),
});
export type HymnOfDay = z.infer<typeof HymnOfDaySchema>;

/** One video in the Home "Watch" row (D-034). Always a YouTube embed; `href` is its source page. */
export const WatchItemSchema = z.object({
  kind: z.enum(WATCH_KINDS),
  key: z.string(),
  youtubeId: z.string(),
  title: z.string(),
  /** Podcast, church / author, or "Hymnal". */
  source: z.string(),
  href: z.string(),
  at: z.string().datetime(),
});
export type WatchItem = z.infer<typeof WatchItemSchema>;

/** GET /api/public/home?date= — everything Home shows around the feed (D-033). */
export const HomeSummarySchema = z.object({
  date: IsoDateSchema,
  today: z.object({
    season: z.enum(LITURGICAL_SEASONS),
    color: z.enum(LITURGICAL_COLORS),
    celebration: z.string().nullable(),
    /** Gospel citation if the day's readings are loaded. */
    gospel: z.string().nullable(),
  }),
  saint: SaintSummarySchema.nullable(),
  hymn: HymnOfDaySchema.nullable(),
  news: z.array(NewsSummarySchema),
  trending: z.array(PostSummarySchema),
  events: z.array(PostSummarySchema),
  /** Horizontal "Watch" row (D-034); empty when there are no videos. */
  watch: z.array(WatchItemSchema),
});
export type HomeSummary = z.infer<typeof HomeSummarySchema>;

export const FeedItemTypeSchema = z.enum(FEED_ITEM_TYPES);

const EpisodeFeedSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  durationSec: z.number().int().nullable(),
  mediaKind: z.string(),
  podcast: z.object({ slug: z.string(), title: z.string(), coverUrl: z.string().url().nullable() }),
});

export const FeedItemSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("POST"), at: z.string().datetime(), post: PostSummarySchema }),
  z.object({
    type: z.literal("TEACHING"),
    at: z.string().datetime(),
    teaching: TeachingSummarySchema,
  }),
  z.object({ type: z.literal("EPISODE"), at: z.string().datetime(), episode: EpisodeFeedSchema }),
  z.object({ type: z.literal("NEWS"), at: z.string().datetime(), news: NewsSummarySchema }),
]);
export type FeedItem = z.infer<typeof FeedItemSchema>;

export const HomeFeedQuerySchema = z.object({
  tab: z.enum(["for-you", "following"]).default("for-you"),
  page: z.coerce.number().int().min(1).max(20).default(1),
});
export const HomeFeedSchema = z.object({
  items: z.array(FeedItemSchema),
  page: z.number().int(),
  hasMore: z.boolean(),
});
export type HomeFeed = z.infer<typeof HomeFeedSchema>;
