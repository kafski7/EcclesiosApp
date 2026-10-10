import { Module } from "@nestjs/common";
import { NewsAdminController, NewsController } from "./news.controller";
import { NewsService } from "./news.service";

/** Platform news (D-032). */
@Module({
  controllers: [NewsController, NewsAdminController],
  providers: [NewsService],
  exports: [NewsService],
})
export class NewsModule {}
