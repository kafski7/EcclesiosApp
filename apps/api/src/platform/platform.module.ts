import { Module } from "@nestjs/common";
import { PlatformController } from "./platform.controller";
import { PlatformRoleGuard } from "./platform-role";
import { PlatformService } from "./platform.service";

@Module({
  controllers: [PlatformController],
  providers: [PlatformService, PlatformRoleGuard],
  exports: [PlatformRoleGuard],
})
export class PlatformModule {}
