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
