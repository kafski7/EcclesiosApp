/** Pending outstation collections state machine (blueprint §8.1, decision D-001). */
export const COLLECTION_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "SYNCED",
  "SYNC_FAILED",
] as const;
export type CollectionStatus = (typeof COLLECTION_STATUSES)[number];

export const COLLECTION_ACTIONS = ["approve", "reject", "syncOk", "syncFail", "retry"] as const;
export type CollectionAction = (typeof COLLECTION_ACTIONS)[number];

const TRANSITIONS: Record<CollectionStatus, Partial<Record<CollectionAction, CollectionStatus>>> = {
  PENDING: { approve: "APPROVED", reject: "REJECTED" },
  APPROVED: { syncOk: "SYNCED", syncFail: "SYNC_FAILED" },
  SYNC_FAILED: { retry: "APPROVED" },
  REJECTED: {},
  SYNCED: {},
};

export class InvalidCollectionTransition extends Error {
  constructor(
    readonly from: CollectionStatus,
    readonly action: CollectionAction,
  ) {
    super(`Cannot ${action} a collection in status ${from}`);
  }
}

export function nextCollectionStatus(
  from: CollectionStatus,
  action: CollectionAction,
): CollectionStatus {
  const to = TRANSITIONS[from][action];
  if (!to) throw new InvalidCollectionTransition(from, action);
  return to;
}

/** Only PENDING rows are editable, and only by whoever recorded them. */
export const isCollectionEditable = (status: CollectionStatus) => status === "PENDING";
export const isCollectionFinal = (status: CollectionStatus) =>
  status === "SYNCED" || status === "REJECTED";

// ------------------------------------------------------------------ recording (Phase 6.4, D-041)

export const COLLECTION_CATEGORIES = [
  "SUNDAY_OFFERTORY",
  "SECOND_COLLECTION",
  "HARVEST_PLEDGE",
  "TITHE",
  "THANKSGIVING",
  "DONATION",
  "OTHER",
] as const;
export type CollectionCategory = (typeof COLLECTION_CATEGORIES)[number];

export const COLLECTION_CATEGORY_LABEL: Record<CollectionCategory, string> = {
  SUNDAY_OFFERTORY: "Sunday offertory",
  SECOND_COLLECTION: "Second collection",
  HARVEST_PLEDGE: "Harvest pledge",
  TITHE: "Tithe",
  THANKSGIVING: "Thanksgiving",
  DONATION: "Donation",
  OTHER: "Other",
};

export const categoryLabel = (code: string) =>
  COLLECTION_CATEGORY_LABEL[code as CollectionCategory] ?? code;

/** How far back a collection may be dated when back-dating is switched on. */
export const MAX_BACKDATE_DAYS = 90;

/**
 * Date rules (D-041): never in the future; today only unless the church allows back-dated
 * entries (Settings), and then at most MAX_BACKDATE_DAYS ago. Dates are YYYY-MM-DD.
 */
export function collectionDateProblem(
  date: string,
  today: string,
  allowBackdating: boolean,
): string | null {
  if (date > today) return "The date can't be in the future.";
  if (date === today) return null;
  if (!allowBackdating)
    return "Back-dated entries are switched off for this church. Use today's date, or ask an Administrator to turn them on in Settings.";
  const days = (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86_400_000;
  if (days > MAX_BACKDATE_DAYS)
    return `Collections can be back-dated by up to ${MAX_BACKDATE_DAYS} days.`;
  return null;
}

/** "120.5" → 12050 (minor units); money is never handled as floats. */
export function toMinor(amount: string): number {
  const m = /^(\d{1,12})(?:\.(\d{1,2}))?$/.exec(amount.trim());
  if (!m) throw new Error(`Invalid amount: ${amount}`);
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
}
export const fromMinor = (minor: number) =>
  `${Math.trunc(minor / 100)}.${String(Math.abs(minor % 100)).padStart(2, "0")}`;

/** Sum decimal strings exactly. */
export const sumAmounts = (amounts: readonly string[]) =>
  fromMinor(amounts.reduce((s, a) => s + toMinor(a), 0));
