/**
 * DEV Bible data (D-023). Two public-domain translations are registered; the seed holds a few
 * clearly labelled sample verses so the reader, picker and Readings links work without a download.
 * Load the real text with:  pnpm bible:import -- --translation WEBC --dir <folder of .usfm files>
 */
export const BIBLE_TRANSLATIONS = [
  {
    code: "WEBC",
    name: "World English Bible (Catholic)",
    language: "en",
    attribution: "World English Bible — public domain.",
    licence: "Public domain. Catholic edition with the deuterocanonical books.",
    isDefault: true,
    offlineAllowed: true,
    psalmNumbering: "HEBREW",
  },
  {
    code: "DRA",
    name: "Douay-Rheims",
    language: "en",
    attribution: "Douay-Rheims (Challoner revision) — public domain.",
    licence: "Public domain.",
    isDefault: false,
    offlineAllowed: true,
    psalmNumbering: "VULGATE",
  },
] as const;

/** Chapters with sample verses: [book, chapter, verse count]. Covers the seeded readings' Gospels. */
const SAMPLE_CHAPTERS: [string, number, number][] = [
  ["GEN", 1, 5],
  ["PSA", 23, 6],
  ["LUK", 10, 24],
  ["LUK", 11, 13],
  ["JHN", 1, 5],
  ["MAT", 21, 46],
];

export function sampleVerses(translation: string) {
  return SAMPLE_CHAPTERS.flatMap(([book, chapter, count]) =>
    Array.from({ length: count }, (_, i) => ({
      book,
      chapter,
      verse: i + 1,
      text: `[Sample text — ${translation}] ${book} ${chapter}:${i + 1}. Import the full translation to read the real text.`,
      woj: [] as [number, number][],
    })),
  );
}
