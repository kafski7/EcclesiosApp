import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AccountController } from "./account.controller";
import { AccountService } from "./account.service";

/** Own profile, password and notifications (Phase 6.3, D-039). */
@Module({ imports: [AuthModule], controllers: [AccountController], providers: [AccountService] })
export class AccountModule {}
