import { Controller, Get, HttpStatus, Inject, Res } from "@nestjs/common";
import type { HealthResponse } from "@ecclesios/shared";
import { sql } from "drizzle-orm";
import type { Response } from "express";
import { Public } from "../common/public.decorator";
import { DB, type Database } from "../db/db.module";

/** GET /api/health — liveness + database check (todo P2). 503 when the DB is unreachable. */
@Public()
@Controller("health")
export class HealthController {
  constructor(@Inject(DB) private readonly db: Database) {}

  @Get()
  async check(@Res({ passthrough: true }) res: Response): Promise<HealthResponse> {
    let database: "up" | "down" = "up";
    try {
      await this.db.execute(sql`select 1`);
    } catch {
      database = "down";
    }
    if (database === "down") res.status(HttpStatus.SERVICE_UNAVAILABLE);
    return {
      status: database === "up" ? "ok" : "down",
      service: "ecclesios-api",
      checks: { database },
      time: new Date().toISOString(),
    };
  }
}
