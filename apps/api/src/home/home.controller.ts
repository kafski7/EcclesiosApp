import { Body, Controller, Get, Param, Put, Query } from "@nestjs/common";
import { HomeFeedQuerySchema, HomeQuerySchema, IsoDateSchema, PinHymnSchema, type Principal } from "@ecclesios/shared";
import { toIsoDate } from "@ecclesios/shared/domain";
import type { z } from "zod";
import { CurrentPrincipal } from "../common/principal.decorator";
import { Public } from "../common/public.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { PlatformRole } from "../platform/platform-role";
import { HomeService } from "./home.service";

/** GET /api/public/home* (functionality §3.1, D-033). A token, if sent, enables the Following tab. */
@Public()
@Controller("public/home")
export class HomeController {
  constructor(private readonly home: HomeService) {}

  /** ?date= is the reader's local date (defaults to UTC today). */
  @Get()
  summary(@Query(new ZodPipe(HomeQuerySchema)) q: z.output<typeof HomeQuerySchema>) {
    return this.home.summary(q.date ?? toIsoDate(new Date()));
  }

  @Get("feed")
  feed(@Query(new ZodPipe(HomeFeedQuerySchema)) q: z.output<typeof HomeFeedQuerySchema>, @CurrentPrincipal() p: Principal | undefined) {
    return this.home.feed(q.tab, q.page, p);
  }
}

/** Super-Admin: choose the hymn of the day for a date (feasts, special days). */
@PlatformRole("SUPER_ADMIN")
@Controller("platform/hymn-of-day")
export class HymnOfDayAdminController {
  constructor(private readonly home: HomeService) {}

  @Get(":date")
  get(@Param("date", new ZodPipe(IsoDateSchema)) date: string) {
    return this.home.hymnOfDay(date);
  }

  @Put(":date")
  pin(@Param("date", new ZodPipe(IsoDateSchema)) date: string, @Body(new ZodPipe(PinHymnSchema)) b: z.output<typeof PinHymnSchema>) {
    return this.home.pinHymn(date, b.hymnSlug);
  }
}
