import { z } from "zod";
import { containsLink, MAX_MENTIONS, mentionIds } from "../domain/engagement.js";
import { COMMENT_MAX, COMMENT_STATUSES, POST_KINDS, POST_STATUSES } from "../domain/explore.js";

export const PostKindSchema = z.enum(POST_KINDS);
export const PostStatusSchema = z.enum(POST_STATUSES);
export const CommentStatusSchema = z.enum(COMMENT_STATUSES);

/** Who a post is by, as shown to readers (D-031). */
export const PostAuthorSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("CHURCH"), id: z.string().uuid(), name: z.string(), level: z.string() }),
  z.object({ kind: z.literal("PERSON"), name: z.string() }),
  z.object({ kind: z.literal("PLATFORM"), name: z.string() }),
]);
export type PostAuthor = z.infer<typeof PostAuthorSchema>;

export const PostEventSchema = z.object({
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().nullable(),
  place: z.string(),
  onlineUrl: z.string().url().nullable(),
});

export const PostSummarySchema = z.object({
  id: z.string().uuid(),
  kind: PostKindSchema,
  title: z.string(),
  summary: z.string(),
  author: PostAuthorSchema,
  coverUrl: z.string().url().nullable(),
  youtubeId: z.string().nullable(),
  event: PostEventSchema.nullable(),
  publishedAt: z.string().datetime().nullable(),
  commentCount: z.number().int(),
});
export type PostSummary = z.infer<typeof PostSummarySchema>;

export const ExploreQuerySchema = z.object({
  kind: PostKindSchema.optional(),
  /** Posts by this church. */
  church: z.string().uuid().optional(),
  /** "1": only churches the signed-in member follows. */
  following: z.enum(["1"]).optional(),
  /** Events: "1" lists past events instead of upcoming ones. */
  past: z.enum(["1"]).optional(),
  q: z.string().trim().max(100).default(""),
  page: z.coerce.number().int().min(1).default(1),
});
export const PostListSchema = z.object({ items: z.array(PostSummarySchema), page: z.number().int(), hasMore: z.boolean() });

export const PostSchema = PostSummarySchema.extend({ body: z.string() });
export type Post = z.infer<typeof PostSchema>;

export const CommentSchema = z.object({
  id: z.string().uuid(),
  author: z.object({ name: z.string(), isMe: z.boolean() }),
  /** Stored form: mentions are `@{memberId}` tokens (D-035); render with `mentions`. */
  body: z.string(),
  /** Names for the mention tokens in `body`. */
  mentions: z.array(z.object({ id: z.string().uuid(), name: z.string() })),
  status: CommentStatusSchema,
  createdAt: z.string().datetime(),
  /** The caller may delete it (their own). */
  canDelete: z.boolean(),
  /** The caller may hide / restore it (post managers, Super-Admins). */
  canModerate: z.boolean(),
});
export type Comment = z.infer<typeof CommentSchema>;
export const CommentListSchema = z.object({ items: z.array(CommentSchema) });
/** No links in comments (D-035); mentions as `@{memberId}` tokens. */
export const NewCommentSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Write a comment")
    .max(COMMENT_MAX)
    .refine((b) => !containsLink(b), "Links aren't allowed in comments.")
    .refine((b) => mentionIds(b).length <= MAX_MENTIONS, `Mention at most ${MAX_MENTIONS} people.`),
});
export const CommentStatusChangeSchema = z.object({ status: CommentStatusSchema });

// ------------------------------------------------------------------ churches (profiles)

export const ChurchProfileSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  level: z.string(),
  /** "St Joseph Deanery · Sample Suffragan Diocese" or "Outstation of …". */
  context: z.string(),
  about: z.string(),
  address: z.string().nullable(),
  massTimes: z.string().nullable(),
  phone: z.string().nullable(),
  website: z.string().url().nullable(),
  coverUrl: z.string().url().nullable(),
  followers: z.number().int(),
  /** The caller administers this church (edit profile, post in its name). */
  canManage: z.boolean(),
});
export type ChurchProfile = z.infer<typeof ChurchProfileSchema>;

export const UpdateChurchProfileSchema = z.object({
  about: z.string().trim().max(3000).default(""),
  address: z.string().trim().max(300).nullable().default(null),
  massTimes: z.string().trim().max(1000).nullable().default(null),
  phone: z.string().trim().max(40).nullable().default(null),
  website: z.string().trim().url("Use a full address, e.g. https://…").max(300).nullable().default(null),
});
export type UpdateChurchProfile = z.infer<typeof UpdateChurchProfileSchema>;

// ------------------------------------------------------------------ authoring

/** Where the caller may post (D-017): as themselves and/or in these churches' names. */
export const AuthoringOptionsSchema = z.object({
  asSelf: z.boolean(),
  churches: z.array(z.object({ id: z.string().uuid(), name: z.string() })),
});
export type AuthoringOptions = z.infer<typeof AuthoringOptionsSchema>;

const optionalDate = z
  .string()
  .datetime({ offset: true })
  .nullable()
  .default(null)
  .or(z.literal("").transform(() => null));

export const UpsertPostSchema = z.object({
  kind: PostKindSchema,
  /** Null = post as yourself; a church id = post in that church's name. Fixed after creation. */
  churchId: z.string().uuid().nullable().default(null),
  title: z.string().trim().min(3, "Give it a title").max(160),
  summary: z.string().trim().max(280).default(""),
  /** Lesson format (D-030): headings, quotes, lists, **bold**, *italic*, [[John 3:16]], [[CCC 1213]]. */
  body: z.string().max(20000).default(""),
  youtube: z.string().trim().max(200).nullable().default(null),
  startsAt: optionalDate,
  endsAt: optionalDate,
  place: z.string().trim().max(200).nullable().default(null),
  onlineUrl: z.string().trim().url().max(300).nullable().default(null).or(z.literal("").transform(() => null)),
});
export type UpsertPost = z.input<typeof UpsertPostSchema>;

export const MyPostSchema = PostSchema.extend({
  status: PostStatusSchema,
  reviewNote: z.string().nullable(),
  churchId: z.string().uuid().nullable(),
  /** Raw editor values. */
  youtube: z.string().nullable(),
  problems: z.array(z.string()),
  updatedAt: z.string().datetime(),
});
export type MyPost = z.infer<typeof MyPostSchema>;
export const MyPostListSchema = z.object({ items: z.array(MyPostSchema) });

export const PostUploadSchema = z.object({
  contentType: z.string().max(100),
  bytes: z.number().int().min(1).max(5 * 1024 * 1024, "The image is too large (max 5 MB)."),
});
export const AttachPostCoverSchema = z.object({ key: z.string().min(5).max(300).nullable() });

// ------------------------------------------------------------------ moderation (Super-Admin)

export const ModerationQueueItemSchema = MyPostSchema.extend({
  submittedBy: z.string(),
  submittedAt: z.string().datetime().nullable(),
});
export const ModerationQueueSchema = z.object({ items: z.array(ModerationQueueItemSchema) });

export const PostDecisionSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("approve"), note: z.string().trim().max(500).optional() }),
  z.object({ decision: z.literal("reject"), note: z.string().trim().min(3, "Tell the author why").max(500) }),
  z.object({ decision: z.literal("remove"), note: z.string().trim().min(3, "Give a reason").max(500) }),
]);
export type PostDecision = z.infer<typeof PostDecisionSchema>;

export const ReportedCommentSchema = z.object({
  id: z.string().uuid(),
  body: z.string(),
  status: CommentStatusSchema,
  author: z.string(),
  reports: z.number().int(),
  post: z.object({ id: z.string().uuid(), title: z.string() }),
  createdAt: z.string().datetime(),
});
export const ReportedCommentListSchema = z.object({ items: z.array(ReportedCommentSchema) });
