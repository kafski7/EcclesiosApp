import { Module } from "@nestjs/common";
import { ExploreModule } from "../explore/explore.module";
import { NewsModule } from "../news/news.module";
import { SocialModule } from "../social/social.module";
import { HomeController, HymnOfDayAdminController } from "./home.controller";
import { HomeService } from "./home.service";

/** Home (D-033): blends Readings, Saints, Hymnal, News, Explore, Teachings and Podcasts. */
@Module({
  imports: [ExploreModule, NewsModule, SocialModule],
  controllers: [HomeController, HymnOfDayAdminController],
  providers: [HomeService],
})
export class HomeModule {}
