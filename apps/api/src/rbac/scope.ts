import { SetMetadata } from "@nestjs/common";
import { canApprove, canReadAggregates, canReadRecords, canReadSummaries, canWrite, type Access } from "@ecclesios/shared/domain";

/**
 * What a route needs in the target group (blueprint §3.3 / §3.5).
 * Decision D-008: the decorator names a *capability*; the hierarchy level that grants it
 * lives in resolveAccess, so routes never hard-code levels.
 */
export const SCOPE_NEEDS = ["write", "approve", "readRecords", "readSummaries", "readAggregates"] as const;
export type ScopeNeed = (typeof SCOPE_NEEDS)[number];

export const CAPABILITY: Record<ScopeNeed, (a: Access) => boolean> = {
  write: canWrite,
  approve: canApprove,
  readRecords: canReadRecords,
  readSummaries: canReadSummaries,
  readAggregates: canReadAggregates,
};

export interface ScopeOptions {
  need: ScopeNeed;
  /** Route param holding the target group id (default "groupId"). */
  param?: string;
}

export const SCOPE_KEY = "ecclesios:scope";

/** @Scope({ need: "write" }) on a route with :groupId — enforced by ScopeGuard. */
export const Scope = (opts: ScopeOptions) => SetMetadata(SCOPE_KEY, { param: "groupId", ...opts });
