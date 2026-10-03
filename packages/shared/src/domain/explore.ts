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
