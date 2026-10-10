import { Inject, Injectable } from "@nestjs/common";
import { readingDays, readings } from "@ecclesios/db";
import type { ReadingDay, UpsertReadingDaySchema } from "@ecclesios/shared";
import { liturgicalDay } from "@ecclesios/shared/domain";
import { asc, eq } from "drizzle-orm";
import type { z } from "zod";
import { AuditService } from "../audit/audit.service";
import { DB, type Database } from "../db/db.module";

type Upsert = z.output<typeof UpsertReadingDaySchema>;

/** Daily Mass readings (functionality §3.2, D-022). */
@Injectable()
export class ReadingsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  /** Always answers: the liturgical context is computed even when no readings are stored. */
  async byDate(date: string): Promise<ReadingDay> {
    const ctx = liturgicalDay(date);
    const [day] = await this.db
      .select()
      .from(readingDays)
      .where(eq(readingDays.date, date))
      .limit(1);
    const rows = day
      ? await this.db
          .select()
          .from(readings)
          .where(eq(readings.readingDayId, day.id))
          .orderBy(asc(readings.position))
      : [];
    return {
      date,
      season: ctx.season,
      color: day?.color ?? ctx.color,
      sundayCycle: ctx.sundayCycle,
      weekdayCycle: ctx.weekdayCycle,
      celebration: day?.celebration ?? null,
      available: rows.length > 0,
      readings: rows.map((r) => ({
        kind: r.kind,
        citation: r.citation,
        response: r.response,
        text: r.text,
      })),
      source: day?.source ?? null,
    };
  }

  /** Super-Admin: replace the readings of one date (functionality §3.2 "administered by the platform"). */
  async upsert(userId: string, date: string, body: Upsert, ip: string): Promise<ReadingDay> {
    await this.db.transaction(async (tx) => {
      const [day] = await tx
        .insert(readingDays)
        .values({ date, celebration: body.celebration, color: body.color, source: body.source })
        .onConflictDoUpdate({
          target: readingDays.date,
          set: {
            celebration: body.celebration,
            color: body.color,
            source: body.source,
            updatedAt: new Date(),
          },
        })
        .returning({ id: readingDays.id });
      await tx.delete(readings).where(eq(readings.readingDayId, day!.id));
      await tx
        .insert(readings)
        .values(body.readings.map((r, position) => ({ ...r, position, readingDayId: day!.id })));
    });
    await this.audit.write({
      actorType: "USER",
      actorId: userId,
      action: "readings.upserted",
      entityType: "reading_day",
      entityId: date,
      metadata: { count: body.readings.length },
      ip,
    });
    return this.byDate(date);
  }
}
