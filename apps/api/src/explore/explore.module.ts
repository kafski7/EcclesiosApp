import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ChurchPagesService } from "./churches.service";
import { CommentsService } from "./comments.service";
import { ExploreAccess } from "./explore-access";
import { ExploreController, ExploreModerationController, ExplorePublicController } from "./explore.controller";
import { ExploreService } from "./explore.service";

/** Explore (functionality §3.4, D-017, D-031). */
@Module({
  imports: [AuthModule],
  controllers: [ExplorePublicController, ExploreController, ExploreModerationController],
  providers: [ExploreAccess, ExploreService, CommentsService, ChurchPagesService],
  // Home (D-033) reuses post summaries.
  exports: [ExploreService],
})
export class ExploreModule {}
