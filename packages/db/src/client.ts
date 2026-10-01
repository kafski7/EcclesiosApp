import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = ReturnType<typeof createDb>["db"];

/** One pool per process. The API wraps this in a NestJS provider (Phase 2). */
export function createDb(url = process.env.DATABASE_URL, opts: { max?: number } = {}) {
  if (!url) throw new Error("DATABASE_URL is not set");
  const client = postgres(url, { max: opts.max ?? 10 });
  const db = drizzle(client, { schema, casing: "snake_case" });
  return { db, client, close: () => client.end() };
}
