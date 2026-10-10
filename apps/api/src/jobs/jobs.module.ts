import { Global, Module } from "@nestjs/common";
import { Jobs } from "./jobs.service";

/** BullMQ queues and workers (Phase 7, D-050). Global: any service may queue work. */
@Global()
@Module({ providers: [Jobs], exports: [Jobs] })
export class JobsModule {}
