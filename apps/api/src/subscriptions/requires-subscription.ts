import { SetMetadata } from "@nestjs/common";

export const REQUIRES_SUBSCRIPTION = "ecclesios:requiresSubscription";

/**
 * Route needs an open subscription for its :groupId (functionality §6, D-020).
 * Enforced by SubscriptionGuard, which runs after the scope guard.
 */
export const RequiresSubscription = (param = "groupId") =>
  SetMetadata(REQUIRES_SUBSCRIPTION, param);
