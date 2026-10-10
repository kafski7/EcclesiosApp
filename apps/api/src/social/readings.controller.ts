import { Body, Controller, Get, Param, Put, Req } from "@nestjs/common";
import {
  IsoDateSchema,
  UpsertReadingDaySchema,
  type Principal,
  type ReadingDay,
} from "@ecclesios/shared";
import { toIsoDate } from "@ecclesios/shared/domain";
import type { Request } from "express";
import type { z } from "zod";
import { CurrentPrincipal } from "../common/principal.decorator";
import { Public } from "../common/public.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { PlatformRole } from "../platform/platform-role";
import { ReadingsService } from "./readings.service";

@Controller()
export class ReadingsController {
  constructor(private readonly readings: ReadingsService) {}

  /** GET /api/public/readings/:date — date is YYYY-MM-DD or "today". */
  @Public()
  @Get("public/readings/:date")
  byDate(@Param("date") raw: string): Promise<ReadingDay> {
    const date =
      raw === "today" ? toIsoDate(new Date()) : new ZodPipe(IsoDateSchema).transform(raw);
    return this.readings.byDate(date);
  }

  /** PUT /api/platform/readings/:date — Super-Admin replaces a day's readings. */
  @PlatformRole("SUPER_ADMIN")
  @Put("platform/readings/:date")
  upsert(
    @Param("date", new ZodPipe(IsoDateSchema)) date: string,
    @Body(new ZodPipe(UpsertReadingDaySchema)) body: z.output<typeof UpsertReadingDaySchema>,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ): Promise<ReadingDay> {
    return this.readings.upsert(p!.id, date, body, req.ip ?? "unknown");
  }
}
