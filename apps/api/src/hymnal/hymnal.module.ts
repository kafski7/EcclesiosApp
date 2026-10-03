import { Module } from "@nestjs/common";
import { HymnalAdminController, HymnalController } from "./hymnal.controller";
import { HymnalService } from "./hymnal.service";

/** Hymnal (functionality §3.6, D-026). Playlists arrive with personal subscriptions. */
@Module({ controllers: [HymnalController, HymnalAdminController], providers: [HymnalService] })
export class HymnalModule {}
