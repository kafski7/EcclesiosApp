/**
 * Who may publish on Explore (D-017). Posting is a privilege, not a default:
 * reverence and order come first. Anyone signed in may read, follow and comment.
 */
import type { MembershipNode } from "./memberships.js";
import type { PlatformPrivilege, PlatformRole } from "./levels.js";

export type ExploreActor =
  | {
      kind: "member";
      privileges: readonly PlatformPrivilege[];
      memberships: readonly MembershipNode[];
    }
  | { kind: "user"; role: PlatformRole; privileges: readonly PlatformPrivilege[] };

/** Post under your own name: approved content creators and platform staff. */
export function canPostAsSelf(actor: ExploreActor): boolean {
  if (actor.kind === "user")
    return actor.role === "SUPER_ADMIN" || actor.privileges.includes("AUTHOR_EXPLORE");
  return actor.privileges.includes("AUTHOR_EXPLORE");
}

/** Post in a church's name: an ACTIVE Administrator (the priest / office) of exactly that church. */
export function canPostAsChurch(actor: ExploreActor, groupId: string): boolean {
  if (actor.kind !== "member") return false;
  return actor.memberships.some(
    (m) => m.status === "ACTIVE" && m.role === "ADMINISTRATOR" && m.group.id === groupId,
  );
}

// ------------------------------------------------------------------ posts (Phase 5.7, D-031)

export const POST_KINDS = ["ARTICLE", "EVENT"] as const;
export type PostKind = (typeof POST_KINDS)[number];

/**
 * DRAFT → PENDING (submitted) → APPROVED | REJECTED. APPROVED → REMOVED (Super-Admin, with a reason).
 * Editing a PENDING/APPROVED/REJECTED post returns it to DRAFT; the author submits again.
 */
export const POST_STATUSES = ["DRAFT", "PENDING", "APPROVED", "REJECTED", "REMOVED"] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export const POST_ACTIONS = ["submit", "approve", "reject", "remove", "edit"] as const;
export type PostAction = (typeof POST_ACTIONS)[number];

const POST_TRANSITIONS: Record<PostStatus, Partial<Record<PostAction, PostStatus>>> = {
  DRAFT: { submit: "PENDING", edit: "DRAFT" },
  PENDING: { approve: "APPROVED", reject: "REJECTED", edit: "DRAFT" },
  APPROVED: { remove: "REMOVED", edit: "DRAFT" },
  REJECTED: { edit: "DRAFT" },
  REMOVED: {},
};

export class InvalidPostTransition extends Error {
  constructor(
    readonly from: PostStatus,
    readonly action: PostAction,
  ) {
    super(`Cannot ${action} a post that is ${from.toLowerCase()}`);
  }
}

export function nextPostStatus(from: PostStatus, action: PostAction): PostStatus {
  const to = POST_TRANSITIONS[from][action];
  if (!to) throw new InvalidPostTransition(from, action);
  return to;
}

/** Super-Admins' own posts skip the queue: submitting publishes straight away. */
export const submitSkipsQueue = (actor: ExploreActor) =>
  actor.kind === "user" && actor.role === "SUPER_ADMIN";

export interface PostAuthorRef {
  authorUserId: string | null;
  authorMemberId: string | null;
  churchId: string | null;
}

/**
 * May edit / submit / delete a post. A church post belongs to the church: any of its active
 * Administrators may manage it, not only the one who wrote it. A personal post belongs to its author.
 * Super-Admins may manage everything.
 */
export function canManagePost(actor: ExploreActor & { id: string }, p: PostAuthorRef): boolean {
  if (actor.kind === "user" && actor.role === "SUPER_ADMIN") return true;
  if (p.churchId) return canPostAsChurch(actor, p.churchId);
  return actor.kind === "user" ? p.authorUserId === actor.id : p.authorMemberId === actor.id;
}

export interface EventFields {
  startsAt: Date | null;
  endsAt: Date | null;
  place: string | null;
}

/** Problems that block submitting a post (drafts may be incomplete). */
export function postProblems(kind: PostKind, body: string, ev: EventFields): string[] {
  const problems: string[] = [];
  if (!body.trim()) problems.push("Write something before submitting.");
  if (kind === "EVENT") {
    if (!ev.startsAt) problems.push("An event needs a start date and time.");
    if (!ev.place?.trim()) problems.push("Say where the event takes place.");
    if (ev.startsAt && ev.endsAt && ev.endsAt <= ev.startsAt)
      problems.push("The event must end after it starts.");
  }
  return problems;
}

// ------------------------------------------------------------------ comments

export const COMMENT_STATUSES = ["VISIBLE", "HIDDEN"] as const;
export type CommentStatus = (typeof COMMENT_STATUSES)[number];

/** A comment hides itself for review once this many different people report it. */
export const COMMENT_REPORT_THRESHOLD = 3;
export const COMMENT_MAX = 2000;

/** May hide or restore a comment: the post's managers and Super-Admins. Authors delete their own. */
export const canModerateComment = (actor: ExploreActor & { id: string }, post: PostAuthorRef) =>
  canManagePost(actor, post);
