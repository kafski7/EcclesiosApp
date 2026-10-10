import { Global, Module } from "@nestjs/common";
import { NotifyProcessor } from "./notify.processor";
import { NotifyService } from "./notify.service";
import { PreferencesService } from "./preferences.service";

/** Notification fan-out and preferences (Phase 7, D-052). Global: every module notifies. */
@Global()
@Module({
  providers: [NotifyService, NotifyProcessor, PreferencesService],
  exports: [NotifyService, NotifyProcessor, PreferencesService],
})
export class NotifyModule {}
