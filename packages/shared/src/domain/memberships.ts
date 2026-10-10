/**
 * People ↔ churches (decisions D-014 – D-016).
 * A person (members row) holds any number of memberships; each membership has its own role and status.
 * Signing in never depends on memberships — they only unlock church-scoped data.
 */
import type { Access, GroupLookup, GroupNode } from "./access.js";
import { resolveAccess } from "./access.js";
import type { HierarchyLevel, MemberRole } from "./levels.js";

// ------------------------------------------------------------------ status machine
export const MEMBERSHIP_STATUSES = ["PENDING", "ACTIVE", "REJECTED", "LEFT"] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export const MEMBERSHIP_ACTIONS = ["approve", "reject", "leave", "rejoin"] as const;
export type MembershipAction = (typeof MEMBERSHIP_ACTIONS)[number];

const TRANSITIONS: Record<MembershipStatus, Partial<Record<MembershipAction, MembershipStatus>>> = {
  PENDING: { approve: "ACTIVE", reject: "REJECTED", leave: "LEFT" }, // leave = cancel the request
  ACTIVE: { leave: "LEFT" },
  REJECTED: { rejoin: "PENDING" },
  LEFT: { rejoin: "PENDING" },
};

export class InvalidMembershipTransition extends Error {
  constructor(
    readonly from: MembershipStatus,
    readonly action: MembershipAction,
  ) {
    super(`Cannot ${action} a membership in status ${from}`);
  }
}

export function nextMembershipStatus(
  from: MembershipStatus,
  action: MembershipAction,
): MembershipStatus {
  const to = TRANSITIONS[from][action];
  if (!to) throw new InvalidMembershipTransition(from, action);
  return to;
}

/** People join churches, not offices: parishes and outstations only (D-014). */
export const JOINABLE_LEVELS = [
  "PARISH",
  "OUTSTATION",
] as const satisfies readonly HierarchyLevel[];
export const isJoinableLevel = (level: HierarchyLevel) =>
  (JOINABLE_LEVELS as readonly HierarchyLevel[]).includes(level);

/** Roles that run a church's CMS and inherit the hierarchy's oversight (blueprint §3.2). */
export const STAFF_ROLES = ["ADMINISTRATOR", "MANAGER"] as const satisfies readonly MemberRole[];
export const isStaffRole = (role: MemberRole) =>
  (STAFF_ROLES as readonly MemberRole[]).includes(role);

// ------------------------------------------------------------------ home transfers (D-016, D-049)
export const HOME_TRANSFER_STATUSES = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;
export type HomeTransferStatus = (typeof HOME_TRANSFER_STATUSES)[number];
export const HOME_TRANSFER_ACTIONS = ["approve", "reject", "cancel"] as const;
export type HomeTransferAction = (typeof HOME_TRANSFER_ACTIONS)[number];

/** Only an open request moves; every decision is final. */
export function nextHomeTransferStatus(
  from: HomeTransferStatus,
  action: HomeTransferAction,
): HomeTransferStatus | null {
  if (from !== "PENDING") return null;
  return action === "approve" ? "APPROVED" : action === "reject" ? "REJECTED" : "CANCELLED";
}

// ------------------------------------------------------------------ access from memberships
export interface MembershipNode {
  group: GroupNode;
  role: MemberRole;
  status: MembershipStatus;
}

/**
 * Access a person has to a target group: hierarchy access from STAFF memberships,
 * plus "MEMBER" if they are an active non-staff member of exactly that group.
 * "NONE" is excluded — no access is represented by an empty array, not "NONE"
 * (resolveMemberAccess filters it out; MEMBER_ACCESS_ORDER has no "NONE").
 */
export type MemberAccess = Exclude<Access, "NONE"> | "MEMBER";

/**
 * Every access the person holds on `target`, strongest first, without duplicates.
 * Only ACTIVE memberships count — a pending request grants nothing (D-015).
 * Empty array = no church-scoped access at all.
 */
export function resolveMemberAccess(
  memberships: readonly MembershipNode[],
  target: GroupNode,
  lookup: GroupLookup,
): MemberAccess[] {
  const found = new Set<MemberAccess>();
  for (const m of memberships) {
    if (m.status !== "ACTIVE") continue;
    if (isStaffRole(m.role)) {
      const a = resolveAccess(m.group, target, lookup);
      if (a !== "NONE") found.add(a);
    } else if (m.group.id === target.id) {
      found.add("MEMBER");
    }
  }
  return MEMBER_ACCESS_ORDER.filter((a) => found.has(a));
}

/** Strongest first. */
export const MEMBER_ACCESS_ORDER = [
  "OWN",
  "OVERSIGHT",
  "MONITOR_DETAILED",
  "MONITOR_AGGREGATE",
  "MEMBER",
] as const satisfies readonly MemberAccess[];

/** Capabilities a route can require (D-008, extended by D-015 with `memberContent`). */
export const CAPABILITIES = {
  write: (a: MemberAccess) => a === "OWN",
  approve: (a: MemberAccess) => a === "OVERSIGHT",
  readRecords: (a: MemberAccess) => a === "OWN" || a === "OVERSIGHT",
  readSummaries: (a: MemberAccess) => a === "OWN" || a === "OVERSIGHT" || a === "MONITOR_DETAILED",
  readAggregates: (a: MemberAccess) =>
    a === "OWN" || a === "OVERSIGHT" || a === "MONITOR_DETAILED" || a === "MONITOR_AGGREGATE",
  /** Members-only content, dues, notices of a church: its active members and its staff. */
  memberContent: (a: MemberAccess) => a === "MEMBER" || a === "OWN" || a === "OVERSIGHT",
} as const;
export type Capability = keyof typeof CAPABILITIES;

export const hasCapability = (accesses: readonly MemberAccess[], need: Capability) =>
  accesses.some(CAPABILITIES[need]);

/**
 * Who may approve/reject a request to join `target`, or a home transfer into it (D-016):
 * an ACTIVE Administrator of that church, or — as backup — of the parish that oversees it.
 */
export function canDecideMembership(
  memberships: readonly MembershipNode[],
  target: GroupNode,
  lookup: GroupLookup,
): boolean {
  return memberships.some((m) => {
    if (m.status !== "ACTIVE" || m.role !== "ADMINISTRATOR") return false;
    const a = resolveAccess(m.group, target, lookup);
    return a === "OWN" || a === "OVERSIGHT";
  });
}

// ------------------------------------------------------------------ home church
/**
 * Each person has at most one HOME membership (D-016). The home church keeps the
 * sacramental records editable; other churches where they are active may only read them.
 */
export interface HomeMembership {
  groupId: string;
  status: MembershipStatus;
  isHome: boolean;
}

export const homeOf = (ms: readonly HomeMembership[]) =>
  ms.find((m) => m.isHome && m.status === "ACTIVE");

/** Why a home transfer to `toGroupId` is not allowed, or null if it may be requested. */
export function homeTransferBlocker(
  ms: readonly HomeMembership[],
  toGroupId: string,
): string | null {
  const target = ms.find((m) => m.groupId === toGroupId);
  if (!target || target.status !== "ACTIVE") return "NOT_AN_ACTIVE_MEMBER";
  if (target.isHome) return "ALREADY_HOME";
  return null;
}

/** Edit rights on a person's sacramental records: staff of their home church (incl. parish oversight). */
export function canEditSacramentalRecords(
  editor: readonly MembershipNode[],
  home: GroupNode | undefined,
  lookup: GroupLookup,
): boolean {
  if (!home) return false;
  return editor.some((m) => {
    if (m.status !== "ACTIVE" || !isStaffRole(m.role)) return false;
    const a = resolveAccess(m.group, home, lookup);
    return a === "OWN" || a === "OVERSIGHT";
  });
}
