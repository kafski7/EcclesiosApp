import { Module } from "@nestjs/common";
import { EngageController, EngagePublicController } from "./engage.controller";
import { EngageService } from "./engage.service";

/** Likes, saves, Saved list (D-035). */
@Module({
  controllers: [EngagePublicController, EngageController],
  providers: [EngageService],
  exports: [EngageService],
})
export class EngageModule {}
