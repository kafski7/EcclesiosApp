import { Global, Module } from "@nestjs/common";
import { SubscriptionGuard } from "./subscription.guard";
import { SubscriptionsController } from "./subscriptions.controller";
import { SubscriptionsService } from "./subscriptions.service";

/** Platform billing & the CMS subscription gate (Phase 4, functionality §4.11, §6). */
@Global()
@Module({
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, SubscriptionGuard],
  exports: [SubscriptionsService, SubscriptionGuard],
})
export class SubscriptionsModule {}
