import { Module } from "@nestjs/common";
import { BibleController } from "./bible.controller";
import { BibleService } from "./bible.service";
import { ReadingsController } from "./readings.controller";
import { ReadingsService } from "./readings.service";
import { SaintsController } from "./saints.controller";
import { SaintsService } from "./saints.service";

/** Social content (Phase 5): Readings, Bible, Saints; Hymnal, Podcasts, Teachings, Explore, feed next. */
@Module({
  controllers: [ReadingsController, BibleController, SaintsController],
  providers: [ReadingsService, BibleService, SaintsService],
})
export class SocialModule {}
