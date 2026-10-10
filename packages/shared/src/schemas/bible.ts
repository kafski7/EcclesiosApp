import { z } from "zod";

export const TranslationCodeSchema = z
  .string()
  .regex(/^[A-Z0-9-]{2,16}$/, "Translation codes are upper-case, e.g. WEBC");

/** GET /api/public/bible/translations (D-023). */
export const BibleTranslationSchema = z.object({
  code: TranslationCodeSchema,
  name: z.string(),
  language: z.string(),
  /** Credit / licence line shown under every chapter. */
  attribution: z.string(),
  isDefault: z.boolean(),
  /** May be stored on the device for offline reading (licence permitting). */
  offlineAllowed: z.boolean(),
  /** VULGATE = Psalms numbered as in the Douay-Rheims (D-024). */
  psalmNumbering: z.enum(["HEBREW", "VULGATE"]),
  /** Number of books with text loaded (73 when complete). */
  booksLoaded: z.number().int(),
});
export type BibleTranslation = z.infer<typeof BibleTranslationSchema>;
export const BibleTranslationListSchema = z.object({ items: z.array(BibleTranslationSchema) });

export const BibleBookSchema = z.object({
  code: z.string(),
  name: z.string(),
  testament: z.enum(["OT", "NT"]),
  deutero: z.boolean(),
  /** Chapters loaded for this translation; 0 = not loaded. */
  chapters: z.number().int(),
});
export type BibleBook = z.infer<typeof BibleBookSchema>;
export const BibleBookListSchema = z.object({
  translation: TranslationCodeSchema,
  items: z.array(BibleBookSchema),
});

export const BibleVerseSchema = z.object({
  verse: z.number().int(),
  text: z.string(),
  /** Words of Jesus as [start, end) character offsets. */
  woj: z.array(z.tuple([z.number().int(), z.number().int()])),
});
export type BibleVerse = z.infer<typeof BibleVerseSchema>;

const ChapterRefSchema = z.object({ book: z.string(), chapter: z.number().int() }).nullable();

/** GET /api/public/bible/:translation/:book/:chapter */
export const BibleChapterSchema = z.object({
  translation: z.object({ code: TranslationCodeSchema, name: z.string(), attribution: z.string() }),
  book: z.object({ code: z.string(), name: z.string() }),
  chapter: z.number().int(),
  verses: z.array(BibleVerseSchema),
  prev: ChapterRefSchema,
  next: ChapterRefSchema,
});
export type BibleChapter = z.infer<typeof BibleChapterSchema>;

export const BibleSearchQuerySchema = z.object({
  q: z.string().trim().min(2, "Type at least 2 characters").max(100),
  limit: z.coerce.number().int().min(1).max(50).default(25),
});
export const BibleSearchHitSchema = z.object({
  book: z.string(),
  bookName: z.string(),
  chapter: z.number().int(),
  verse: z.number().int(),
  text: z.string(),
});
export type BibleSearchHit = z.infer<typeof BibleSearchHitSchema>;
export const BibleSearchResponseSchema = z.object({ items: z.array(BibleSearchHitSchema) });

export const BIBLE_ERROR_CODES = [
  "TRANSLATION_NOT_FOUND",
  "BOOK_NOT_FOUND",
  "CHAPTER_NOT_FOUND",
] as const;
