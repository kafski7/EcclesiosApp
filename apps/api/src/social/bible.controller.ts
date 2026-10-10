import { Controller, Get, Param, ParseIntPipe, Query } from "@nestjs/common";
import {
  BibleSearchQuerySchema,
  type BibleChapter,
  type BibleSearchHit,
  type BibleTranslation,
} from "@ecclesios/shared";
import type { z } from "zod";
import { DomainError } from "../auth/core/errors";
import { Public } from "../common/public.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { BibleService } from "./bible.service";

const int = new ParseIntPipe({
  exceptionFactory: () => new DomainError(400, "VALIDATION_FAILED", "Chapter must be a number."),
});

/** Public Bible endpoints (functionality §3.8, D-023). */
@Public()
@Controller("public/bible")
export class BibleController {
  constructor(private readonly bible: BibleService) {}

  @Get("translations")
  async translations(): Promise<{ items: BibleTranslation[] }> {
    return { items: await this.bible.translations() };
  }

  @Get(":translation/books")
  books(@Param("translation") t: string) {
    return this.bible.books(t);
  }

  @Get(":translation/search")
  async search(
    @Param("translation") t: string,
    @Query(new ZodPipe(BibleSearchQuerySchema)) q: z.output<typeof BibleSearchQuerySchema>,
  ): Promise<{ items: BibleSearchHit[] }> {
    return { items: await this.bible.search(t, q.q, q.limit) };
  }

  @Get(":translation/:book/:chapter")
  chapter(
    @Param("translation") t: string,
    @Param("book") book: string,
    @Param("chapter", int) chapter: number,
  ): Promise<BibleChapter> {
    return this.bible.chapter(t, book, chapter);
  }
}
