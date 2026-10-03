import { z } from "zod";
import { isIsoDate, LITURGICAL_COLORS, LITURGICAL_SEASONS } from "../domain/liturgy.js";

export const IsoDateSchema = z.string().refine(isIsoDate, "Use a real date as YYYY-MM-DD");

export const READING_KINDS = ["FIRST", "PSALM", "SECOND", "ALLELUIA", "GOSPEL"] as const;
export const ReadingKindSchema = z.enum(READING_KINDS);
export type ReadingKind = z.infer<typeof ReadingKindSchema>;

export const ReadingSchema = z.object({
  kind: ReadingKindSchema,
  citation: z.string().min(1).max(120),
  /** Psalm refrain / Alleluia verse. */
  response: z.string().max(500).nullable(),
  /** Paragraphs, plain text. */
  text: z.array(z.string().max(4000)).max(60),
});
export type Reading = z.infer<typeof ReadingSchema>;

/** GET /api/public/readings/:date — always answers with the computed liturgical context (D-022). */
export const ReadingDaySchema = z.object({
  date: IsoDateSchema,
  season: z.enum(LITURGICAL_SEASONS),
  color: z.enum(LITURGICAL_COLORS),
  sundayCycle: z.enum(["A", "B", "C"]),
  weekdayCycle: z.enum(["I", "II"]),
  /** e.g. "Memorial of Saint Thérèse of the Child Jesus"; null on an ordinary weekday or when not loaded. */
  celebration: z.string().nullable(),
  /** False when no readings are stored for this date yet. */
  available: z.boolean(),
  readings: z.array(ReadingSchema),
  /** Translation / source credit shown under the readings. */
  source: z.string().nullable(),
});
export type ReadingDay = z.infer<typeof ReadingDaySchema>;

/** PUT /api/platform/readings/:date — Super-Admin calendar maintenance. */
export const UpsertReadingDaySchema = z.object({
  celebration: z.string().trim().max(200).nullable().default(null),
  color: z.enum(LITURGICAL_COLORS).nullable().default(null),
  source: z.string().trim().max(200).nullable().default(null),
  readings: z
    .array(ReadingSchema)
    .min(1)
    .max(8)
    .refine((r) => r.some((x) => x.kind === "GOSPEL"), "Every day needs a Gospel"),
});
export type UpsertReadingDay = z.input<typeof UpsertReadingDaySchema>;
