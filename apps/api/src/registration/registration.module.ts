import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { MembershipsModule } from "../memberships/memberships.module";
import { RegistrationController } from "./registration.controller";
import { RegistrationService } from "./registration.service";

@Module({
  imports: [AuthModule, MembershipsModule],
  controllers: [RegistrationController],
  providers: [RegistrationService],
})
export class RegistrationModule {}
