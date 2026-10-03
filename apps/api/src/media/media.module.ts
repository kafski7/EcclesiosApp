import { Global, Module } from "@nestjs/common";
import { MediaService } from "./media.service";

/** Presigned object-storage URLs (blueprint §5). Used by the hymnal, saints and later podcasts/photos. */
@Global()
@Module({ providers: [MediaService], exports: [MediaService] })
export class MediaModule {}
