import { Module } from "@nestjs/common";
import { PodcastFollowsController, PodcastStudioController, PodcastsPublicController } from "./podcasts.controller";
import { PodcastsService } from "./podcasts.service";

/** Podcasts (functionality §3.5, D-027). */
@Module({
  controllers: [PodcastsPublicController, PodcastFollowsController, PodcastStudioController],
  providers: [PodcastsService],
})
export class PodcastsModule {}
