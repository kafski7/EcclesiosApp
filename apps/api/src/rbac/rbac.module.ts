import { Module } from "@nestjs/common";
import { GroupsController } from "./groups.controller";
import { ScopeGuard } from "./scope.guard";
import { ScopeService } from "./scope.service";

@Module({
  controllers: [GroupsController],
  providers: [ScopeService, ScopeGuard],
  exports: [ScopeService, ScopeGuard],
})
export class RbacModule {}
