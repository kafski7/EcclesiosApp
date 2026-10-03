import { Module } from "@nestjs/common";
import { CmsController } from "./cms.controller";
import { CmsService } from "./cms.service";

/** Church Management (functionality §4): contexts + dashboard now; operational modules in Phase 6. */
@Module({
  controllers: [CmsController],
  providers: [CmsService],
})
export class CmsModule {}
