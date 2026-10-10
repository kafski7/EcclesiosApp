/**
 * One text size for every reading view — Readings, Bible, Teachings, hymn words, saints, news
 * (docs/social.md §11.2, D-045). Pure helpers; the store is stores/reader.ts.
 */
export const SCALE_MIN = 0.85;
export const SCALE_MAX = 1.5;
export const SCALE_STEP = 0.1;

/** Clamp to the allowed range and round to one decimal (no 1.0999999 drift). */
export function clampScale(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.round(Math.min(SCALE_MAX, Math.max(SCALE_MIN, n)) * 100) / 100;
}

export const stepScale = (n: number, dir: 1 | -1) => clampScale(n + dir * SCALE_STEP);

export const scalePercent = (n: number) => `${Math.round(clampScale(n) * 100)}%`;

/**
 * Before D-045 only the Bible had a text size, saved under "ecclesios.bible". Carry it over the
 * first time so nobody's chosen size is lost. Anything unreadable → 1.
 */
export function migratedScale(bibleJson: string | null): number {
  if (!bibleJson) return 1;
  try {
    const v = (JSON.parse(bibleJson) as { state?: { fontScale?: unknown } })?.state?.fontScale;
    return typeof v === "number" ? clampScale(v) : 1;
  } catch {
    return 1;
  }
}
