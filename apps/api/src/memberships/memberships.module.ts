import { Module } from "@nestjs/common";
import { RbacModule } from "../rbac/rbac.module";
import { ChurchesService } from "./churches.service";
import { MembershipsController } from "./memberships.controller";
import { MembershipsService } from "./memberships.service";

@Module({
  imports: [RbacModule],
  controllers: [MembershipsController],
  providers: [ChurchesService, MembershipsService],
  exports: [ChurchesService],
})
export class MembershipsModule {}
