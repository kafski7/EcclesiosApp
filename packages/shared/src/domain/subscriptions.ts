/**
 * Subscription gate (functionality §4.11, §6; decision D-020).
 * Pure rules: which group's subscription covers a church, and whether it is open now.
 */
import type { GroupNode } from "./access.js";
import { pathIds } from "./path.js";

export const SUBSCRIPTION_STATUSES = ["TRIAL", "ACTIVE", "EXPIRED", "CANCELLED"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/** What the CMS shows for a church's subscription. NONE = never subscribed. */
export const SUBSCRIPTION_STATES = ["ACTIVE", "TRIAL", "EXPIRED", "NONE"] as const;
export type SubscriptionState = (typeof SUBSCRIPTION_STATES)[number];

export const PLAN_CODES = ["BASIC", "PREMIUM", "ULTIMATE"] as const;
export type PlanCode = (typeof PLAN_CODES)[number];

/** Days before expiry when the CMS starts warning (renew banner). */
export const EXPIRY_WARNING_DAYS = 14;

/**
 * The group whose subscription unlocks the CMS for `target` (functionality §6):
 * a parish holds its own; an outstation rides on its parent parish.
 * Deaneries, dioceses and the province are monitoring accounts — not gated (null).
 */
export function subscriptionHolderId(
  target: Pick<GroupNode, "id" | "level" | "path">,
): string | null {
  if (target.level === "PARISH") return target.id;
  if (target.level === "OUTSTATION") {
    const ids = pathIds(target.path);
    return ids[ids.length - 2] ?? null;
  }
  return null;
}

export interface SubscriptionRow {
  status: SubscriptionStatus;
  startsAt: Date;
  expiresAt: Date;
}

export interface SubscriptionEvaluation {
  state: SubscriptionState;
  /** Whole days until expiry (0 on the last day); null when NONE. Negative once expired. */
  daysLeft: number | null;
  /** True for ACTIVE/TRIAL within EXPIRY_WARNING_DAYS of expiry. */
  expiringSoon: boolean;
}

const DAY = 86_400_000;

/**
 * State of the holder's most recent subscription row at `now`.
 * A TRIAL/ACTIVE row whose expiry has passed counts as EXPIRED even before a job flips its status.
 */
export function evaluateSubscription(
  row: SubscriptionRow | undefined,
  now: Date,
): SubscriptionEvaluation {
  if (!row) return { state: "NONE", daysLeft: null, expiringSoon: false };
  const daysLeft = Math.floor((row.expiresAt.getTime() - now.getTime()) / DAY);
  const status = row.status;
  if ((status !== "ACTIVE" && status !== "TRIAL") || row.expiresAt <= now || row.startsAt > now)
    return { state: "EXPIRED", daysLeft, expiringSoon: false };
  return { state: status, daysLeft, expiringSoon: daysLeft < EXPIRY_WARNING_DAYS };
}

/** The CMS is open for ACTIVE and TRIAL only. */
export const isCmsOpen = (state: SubscriptionState) => state === "ACTIVE" || state === "TRIAL";

/** Picks the row that decides the state: the latest-starting one. */
export function latestSubscription<T extends SubscriptionRow>(rows: readonly T[]): T | undefined {
  return [...rows].sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime())[0];
}

/** A free trial is offered once per holder: only if it has never had any subscription (D-021). */
export const canStartTrial = (rows: readonly SubscriptionRow[]) => rows.length === 0;
