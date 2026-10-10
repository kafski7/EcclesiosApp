/**
 * Selecting verses in the Bible reader to copy or share them (docs/social.md §9.9, D-045).
 * Pure, so it is unit-tested.
 */

/** [16, 17, 18, 20] → [[16, 18], [20, 20]] (sorted, duplicates ignored). */
export function verseRanges(verses: Iterable<number>): [number, number][] {
  const sorted = [...new Set(verses)]
    .filter((n) => Number.isInteger(n) && n > 0)
    .sort((a, b) => a - b);
  const out: [number, number][] = [];
  for (const v of sorted) {
    const last = out[out.length - 1];
    if (last && v === last[1] + 1) last[1] = v;
    else out.push([v, v]);
  }
  return out;
}

/**
 * "John 3:16-18, 20" — the shape parseReference reads back (shared/domain/bible.ts), so the
 * link reopens with the same verses highlighted. Empty selection → "John 3".
 */
export function selectionRef(bookName: string, chapter: number, verses: Iterable<number>): string {
  const parts = verseRanges(verses).map(([a, b]) => (a === b ? `${a}` : `${a}-${b}`));
  return parts.length ? `${bookName} ${chapter}:${parts.join(", ")}` : `${bookName} ${chapter}`;
}

/** The same reference for people: en dashes ("John 3:16–18, 20"). */
export const displayRef = (ref: string) => ref.replace(/(\d)-(\d)/g, "$1–$2");

/**
 * Link to the selection. Citations are read with Hebrew psalm numbers (D-024), so a selection
 * made in a Vulgate-numbered translation's Psalms links to the chapter without verse highlights.
 */
export function selectionLink(
  bookCode: string,
  chapter: number,
  ref: string,
  vulgatePsalm: boolean,
): string {
  const path = `/bible/${bookCode.toLowerCase()}/${chapter}`;
  return vulgatePsalm ? path : `${path}?ref=${encodeURIComponent(ref)}`;
}

/** Text to copy: the verses, then "— John 3:16–18 (WEBC)". */
export function selectionText(
  verses: readonly { verse: number; text: string }[],
  selected: ReadonlySet<number>,
  ref: string,
  translation: string,
): string {
  const body = verses
    .filter((v) => selected.has(v.verse))
    .sort((a, b) => a.verse - b.verse)
    .map((v) => `${v.verse} ${v.text.trim()}`)
    .join(" ");
  return `${body}\n— ${displayRef(ref)} (${translation})`;
}
