import { SetMetadata } from "@nestjs/common";
import type { Capability } from "@ecclesios/shared/domain";

/**
 * What a route needs in the target group (D-008, D-015). The decorator names a capability;
 * which memberships and hierarchy levels grant it is decided by resolveMemberAccess in @ecclesios/shared.
 */
export type ScopeNeed = Capability;

export interface ScopeOptions {
  /** One capability, or several where any one is enough. */
  need: ScopeNeed | readonly ScopeNeed[];
  /** Route param holding the target group id (default "groupId"). */
  param?: string;
}

export const SCOPE_KEY = "ecclesios:scope";

/** @Scope({ need: "write" }) on a route with :groupId — enforced by ScopeGuard. */
export const Scope = (opts: ScopeOptions) => SetMetadata(SCOPE_KEY, { param: "groupId", ...opts });
