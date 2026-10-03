import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { id, timestamps } from "./_common";
import { commentStatusEnum, postKindEnum, postStatusEnum } from "./enums";
import { groups } from "./hierarchy";
import { members, users } from "./identity";

/**
 * Explore posts (functionality §3.4, D-031): articles and events, written by a person
 * (member or platform account) or in a church's name, and moderated before they appear.
 */
export const posts = pgTable(
  "posts",
  {
    id: id(),
    kind: postKindEnum("kind").notNull(),
    status: postStatusEnum("status").notNull().default("DRAFT"),
    /** Who wrote it — exactly one of user/member. */
    authorUserId: uuid("author_user_id").references(() => users.id, { onDelete: "restrict" }),
    authorMemberId: uuid("author_member_id").references(() => members.id, { onDelete: "restrict" }),
    /** Set when posted in a church's name; the church's Administrators manage it. */
    churchId: uuid("church_id").references(() => groups.id, { onDelete: "restrict" }),
    title: varchar("title", { length: 160 }).notNull(),
    summary: varchar("summary", { length: 280 }).notNull().default(""),
    body: text("body").notNull().default(""),
    coverKey: text("cover_key"),
    youtubeId: varchar("youtube_id", { length: 20 }),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    place: varchar("place", { length: 200 }),
    onlineUrl: text("online_url"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, { onDelete: "set null" }),
    reviewNote: text("review_note"),
    ...timestamps(),
  },
  (t) => [
    check("posts_one_author_chk", sql`(${t.authorUserId} IS NULL) <> (${t.authorMemberId} IS NULL)`),
    check("posts_event_chk", sql`${t.kind} <> 'EVENT' OR ${t.status} IN ('DRAFT','REJECTED') OR ${t.startsAt} IS NOT NULL`),
    check("posts_live_chk", sql`${t.status} <> 'APPROVED' OR ${t.publishedAt} IS NOT NULL`),
    index("posts_feed_idx").on(t.status, t.publishedAt),
    index("posts_events_idx").on(t.status, t.kind, t.startsAt),
    index("posts_church_idx").on(t.churchId, t.status),
    index("posts_author_member_idx").on(t.authorMemberId),
    index("posts_author_user_idx").on(t.authorUserId),
    index("posts_queue_idx").on(t.status, t.submittedAt),
    index("posts_fts_idx").using(
      "gin",
      sql`to_tsvector('english', ${t.title} || ' ' || ${t.summary} || ' ' || ${t.body})`,
    ),
  ],
);

/** Comments: post-moderated (visible at once), hidden after reports or by the post's managers. */
export const postComments = pgTable(
  "post_comments",
  {
    id: id(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    body: varchar("body", { length: 2000 }).notNull(),
    status: commentStatusEnum("status").notNull().default("VISIBLE"),
    reportCount: integer("report_count").notNull().default(0),
    ...timestamps(),
  },
  (t) => [index("post_comments_post_idx").on(t.postId, t.status, t.createdAt), index("post_comments_reports_idx").on(t.reportCount)],
);

/** One report per person per comment. */
export const commentReports = pgTable(
  "comment_reports",
  {
    commentId: uuid("comment_id")
      .notNull()
      .references(() => postComments.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.commentId, t.memberId] })],
);

/** A church's public page (D-031): edited by its Administrators, shown at once. */
export const churchProfiles = pgTable("church_profiles", {
  groupId: uuid("group_id")
    .primaryKey()
    .references(() => groups.id, { onDelete: "cascade" }),
  about: text("about").notNull().default(""),
  address: varchar("address", { length: 300 }),
  massTimes: varchar("mass_times", { length: 1000 }),
  phone: varchar("phone", { length: 40 }),
  website: varchar("website", { length: 300 }),
  coverKey: text("cover_key"),
  ...timestamps(),
});
