import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC = "ecclesios:isPublic";
/** Skips the global JWT guard (auth endpoints, health). */
export const Public = () => SetMetadata(IS_PUBLIC, true);
