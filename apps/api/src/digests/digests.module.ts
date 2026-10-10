import { Module } from "@nestjs/common";
import { BirthdayDigest } from "./birthday-digest";

/** Scheduled daily jobs (Phase 7). */
@Module({ providers: [BirthdayDigest], exports: [BirthdayDigest] })
export class DigestsModule {}
