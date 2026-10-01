import { Global, Inject, Module, type OnApplicationShutdown } from "@nestjs/common";
import { createDb, type Database } from "@ecclesios/db";
import { ENV, type Env } from "../config/env";

export const DB = Symbol("DB");
const DB_HANDLE = Symbol("DB_HANDLE");

/** Wraps packages/db createDb (one pool per process) as an injectable (todo P2). */
@Global()
@Module({
  providers: [
    { provide: DB_HANDLE, inject: [ENV], useFactory: (env: Env) => createDb(env.DATABASE_URL) },
    { provide: DB, inject: [DB_HANDLE], useFactory: (h: ReturnType<typeof createDb>) => h.db },
  ],
  exports: [DB],
})
export class DbModule implements OnApplicationShutdown {
  constructor(@Inject(DB_HANDLE) private readonly handle: ReturnType<typeof createDb>) {}
  async onApplicationShutdown() {
    await this.handle.close();
  }
}

export type { Database };
