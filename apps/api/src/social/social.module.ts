import { Module } from "@nestjs/common";
import { BibleController } from "./bible.controller";
import { BibleService } from "./bible.service";
import { ReadingsController } from "./readings.controller";
import { ReadingsService } from "./readings.service";
import { SaintsController } from "./saints.controller";
import { SaintsService } from "./saints.service";
import { TeachingsAdminController, TeachingsController } from "./teachings.controller";
import { TeachingsService } from "./teachings.service";

/** Social content (Phase 5): Readings, Bible, Saints; Hymnal, Podcasts, Teachings, Explore, feed next. */
@Module({
  controllers: [ReadingsController, BibleController, SaintsController, TeachingsController, TeachingsAdminController],
  providers: [ReadingsService, BibleService, SaintsService, TeachingsService],
  // Home (D-033) reuses these.
  exports: [ReadingsService, SaintsService, TeachingsService],
})
export class SocialModule {}
