import { Module } from "@nestjs/common";
import { RbacModule } from "../rbac/rbac.module";
import { accountingProvider } from "../accounting/accounting.gateway";
import { ChurchController } from "./church.controller";
import { ChurchService } from "./church.service";
import { CmsController } from "./cms.controller";
import { CmsService } from "./cms.service";
import { CollectionsController } from "./collections.controller";
import { CollectionsService } from "./collections.service";
import { GroupsController } from "./groups.controller";
import { GroupsService } from "./groups.service";
import { RegisterController } from "./register.controller";
import { RegisterService } from "./register.service";
import { SocietiesController } from "./societies.controller";
import { SocietiesService } from "./societies.service";

/** Church Management (functionality §4): contexts, dashboard, register and birthdays (6.1), societies & committees (6.2). */
@Module({
  imports: [RbacModule],
  controllers: [
    CmsController,
    RegisterController,
    SocietiesController,
    ChurchController,
    GroupsController,
    CollectionsController,
  ],
  providers: [
    CmsService,
    RegisterService,
    SocietiesService,
    ChurchService,
    GroupsService,
    CollectionsService,
    accountingProvider,
  ],
})
export class CmsModule {}
