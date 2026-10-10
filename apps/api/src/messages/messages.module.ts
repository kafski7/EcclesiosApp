import { Module } from "@nestjs/common";
import { RbacModule } from "../rbac/rbac.module";
import { AudienceResolver } from "./audience";
import { MessagesController } from "./messages.controller";
import { MessagesProcessor } from "./messages.processor";
import { MessagesService } from "./messages.service";

/** Messages & broadcasts (functionality §4.7, D-051). */
@Module({
  imports: [RbacModule],
  controllers: [MessagesController],
  providers: [AudienceResolver, MessagesService, MessagesProcessor],
})
export class MessagesModule {}
