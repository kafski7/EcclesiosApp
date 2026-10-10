import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { id, timestamps } from "./_common";
import { episodeMediaKindEnum, episodeStatusEnum, mediaAccessEnum } from "./enums";
import { members, users } from "./identity";

/**
 * Podcasts (functionality §3.5, D-027). A series is owned by exactly one platform account or one
 * member holding POST_PODCASTS; Super-Admins manage all. Audio and covers are object-storage keys.
 */
export const podcasts = pgTable(
  "podcasts",
  {
    id: id(),
    slug: varchar("slug", { length: 100 }).notNull().unique(),
    title: varchar("title", { length: 160 }).notNull(),
    summary: varchar("summary", { length: 280 }).notNull(),
    description: text("description").notNull().default(""),
    category: varchar("category", { length: 40 }),
    coverKey: text("cover_key"),
    ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "restrict" }),
    ownerMemberId: uuid("owner_member_id").references(() => members.id, { onDelete: "restrict" }),
    isPublished: boolean("is_published").notNull().default(true),
    ...timestamps(),
  },
  (t) => [
    index("podcasts_owner_user_idx").on(t.ownerUserId),
    index("podcasts_owner_member_idx").on(t.ownerMemberId),
    check(
      "podcasts_one_owner_chk",
      sql`(${t.ownerUserId} IS NULL) <> (${t.ownerMemberId} IS NULL)`,
    ),
    index("podcasts_fts_idx").using(
      "gin",
      sql`to_tsvector('english', ${t.title} || ' ' || ${t.summary} || ' ' || ${t.description})`,
    ),
  ],
);

export const podcastEpisodes = pgTable(
  "podcast_episodes",
  {
    id: id(),
    podcastId: uuid("podcast_id")
      .notNull()
      .references(() => podcasts.id, { onDelete: "cascade" }),
    number: smallint("number"),
    title: varchar("title", { length: 200 }).notNull(),
    notes: text("notes").notNull().default(""),
    /** Primary media (D-029): AUDIO (upload), YOUTUBE (embed) or VIDEO (reserved for a managed video service). */
    mediaKind: episodeMediaKindEnum("media_kind").notNull().default("AUDIO"),
    audioKey: text("audio_key"),
    contentType: varchar("content_type", { length: 100 }),
    bytes: integer("bytes"),
    durationSec: integer("duration_sec"),
    /** Optional YouTube / YouTube Music video id; may sit alongside uploaded audio. */
    youtubeId: varchar("youtube_id", { length: 11 }),
    /** Listener access (D-026/D-029). Open to all while the paywall is off. */
    access: mediaAccessEnum("access").notNull().default("FREE"),
    transcript: text("transcript").notNull().default(""),
    status: episodeStatusEnum("status").notNull().default("DRAFT"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    index("podcast_episodes_feed_idx").on(t.podcastId, t.status, t.publishedAt),
    uniqueIndex("podcast_episodes_number_uq")
      .on(t.podcastId, t.number)
      .where(sql`${t.number} IS NOT NULL`),
    // Published ⇒ has a publish date and its primary media (VIDEO cannot be published yet — D-029).
    check(
      "podcast_episodes_live_chk",
      sql`${t.status} = 'DRAFT' OR (${t.publishedAt} IS NOT NULL AND ((${t.mediaKind} = 'AUDIO' AND ${t.audioKey} IS NOT NULL) OR (${t.mediaKind} = 'YOUTUBE' AND ${t.youtubeId} IS NOT NULL)))`,
    ),
  ],
);

/** Members following a series get a notification for each new episode (D-027). */
export const podcastFollows = pgTable(
  "podcast_follows",
  {
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    podcastId: uuid("podcast_id")
      .notNull()
      .references(() => podcasts.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.memberId, t.podcastId] }),
    index("podcast_follows_podcast_idx").on(t.podcastId),
  ],
);

/** Episode extras (D-029): PDF handouts. Access follows the episode. */
export const podcastAttachments = pgTable(
  "podcast_attachments",
  {
    id: id(),
    episodeId: uuid("episode_id")
      .notNull()
      .references(() => podcastEpisodes.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 80 }).notNull(),
    objectKey: text("object_key").notNull(),
    contentType: varchar("content_type", { length: 100 }).notNull(),
    bytes: integer("bytes"),
    position: smallint("position").notNull().default(0),
    ...timestamps(),
  },
  (t) => [index("podcast_attachments_episode_idx").on(t.episodeId)],
);
