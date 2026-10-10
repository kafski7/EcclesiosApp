/**
 * Bible canon and reference parsing (functionality §3.8, D-023). Pure and dependency-free.
 * Catholic canon (73 books) in Catholic order. Book codes are USFM ids, so imported USFM
 * files map straight onto them. Chapter counts are NOT fixed here — they differ between
 * translations (e.g. Esther, Daniel, Malachi) and come from the imported data.
 */
export type Testament = "OT" | "NT";

export interface CanonBook {
  code: string;
  name: string;
  testament: Testament;
  /** Deuterocanonical (in Catholic Bibles, not in most Protestant ones). */
  deutero?: boolean;
  /** Extra names/abbreviations accepted in references (lower-case, no dots). */
  aliases: string[];
}

const b = (
  code: string,
  name: string,
  testament: Testament,
  aliases: string[] = [],
  deutero = false,
): CanonBook => ({
  code,
  name,
  testament,
  aliases,
  ...(deutero ? { deutero } : {}),
});

export const CANON: readonly CanonBook[] = [
  b("GEN", "Genesis", "OT", ["gen", "gn"]),
  b("EXO", "Exodus", "OT", ["exod", "ex"]),
  b("LEV", "Leviticus", "OT", ["lev", "lv"]),
  b("NUM", "Numbers", "OT", ["num", "nm"]),
  b("DEU", "Deuteronomy", "OT", ["deut", "dt"]),
  b("JOS", "Joshua", "OT", ["josh", "jos"]),
  b("JDG", "Judges", "OT", ["judg", "jgs"]),
  b("RUT", "Ruth", "OT", ["ru", "ruth"]),
  b("1SA", "1 Samuel", "OT", ["1 sam", "1 sm", "1sam", "1 kings of samuel"]),
  b("2SA", "2 Samuel", "OT", ["2 sam", "2 sm", "2sam"]),
  b("1KI", "1 Kings", "OT", ["1 kgs", "1kgs", "1 kg"]),
  b("2KI", "2 Kings", "OT", ["2 kgs", "2kgs", "2 kg"]),
  b("1CH", "1 Chronicles", "OT", ["1 chr", "1chr", "1 paralipomenon"]),
  b("2CH", "2 Chronicles", "OT", ["2 chr", "2chr", "2 paralipomenon"]),
  b("EZR", "Ezra", "OT", ["ezr", "1 esdras"]),
  b("NEH", "Nehemiah", "OT", ["neh", "2 esdras"]),
  b("TOB", "Tobit", "OT", ["tob", "tb", "tobias"], true),
  b("JDT", "Judith", "OT", ["jdt"], true),
  b("EST", "Esther", "OT", ["esth", "est", "esg"]),
  b("1MA", "1 Maccabees", "OT", ["1 macc", "1 mc", "1macc"], true),
  b("2MA", "2 Maccabees", "OT", ["2 macc", "2 mc", "2macc"], true),
  b("JOB", "Job", "OT", ["jb"]),
  b("PSA", "Psalms", "OT", ["psalm", "ps", "pss"]),
  b("PRO", "Proverbs", "OT", ["prov", "prv"]),
  b("ECC", "Ecclesiastes", "OT", ["eccl", "eccles", "qoheleth"]),
  b("SNG", "Song of Songs", "OT", ["song", "song of solomon", "canticle of canticles", "sg"]),
  b("WIS", "Wisdom", "OT", ["wis", "ws", "wisdom of solomon"], true),
  b("SIR", "Sirach", "OT", ["sir", "ecclesiasticus"], true),
  b("ISA", "Isaiah", "OT", ["isa", "is", "isaias"]),
  b("JER", "Jeremiah", "OT", ["jer", "jeremias"]),
  b("LAM", "Lamentations", "OT", ["lam"]),
  b("BAR", "Baruch", "OT", ["bar"], true),
  b("EZK", "Ezekiel", "OT", ["ezek", "ez", "ezechiel"]),
  b("DAN", "Daniel", "OT", ["dan", "dn"]),
  b("HOS", "Hosea", "OT", ["hos", "osee"]),
  b("JOL", "Joel", "OT", ["jl"]),
  b("AMO", "Amos", "OT", ["am"]),
  b("OBA", "Obadiah", "OT", ["obad", "ob", "abdias"]),
  b("JON", "Jonah", "OT", ["jon", "jonas"]),
  b("MIC", "Micah", "OT", ["mic", "mi", "micheas"]),
  b("NAM", "Nahum", "OT", ["nah", "na"]),
  b("HAB", "Habakkuk", "OT", ["hab", "hb", "habacuc"]),
  b("ZEP", "Zephaniah", "OT", ["zeph", "zep", "sophonias"]),
  b("HAG", "Haggai", "OT", ["hag", "hg", "aggeus"]),
  b("ZEC", "Zechariah", "OT", ["zech", "zec", "zacharias"]),
  b("MAL", "Malachi", "OT", ["mal", "malachias"]),
  b("MAT", "Matthew", "NT", ["matt", "mt"]),
  b("MRK", "Mark", "NT", ["mk", "mar"]),
  b("LUK", "Luke", "NT", ["lk", "luk"]),
  b("JHN", "John", "NT", ["jn", "joh"]),
  b("ACT", "Acts", "NT", ["acts of the apostles", "acts"]),
  b("ROM", "Romans", "NT", ["rom", "rm"]),
  b("1CO", "1 Corinthians", "NT", ["1 cor", "1cor"]),
  b("2CO", "2 Corinthians", "NT", ["2 cor", "2cor"]),
  b("GAL", "Galatians", "NT", ["gal"]),
  b("EPH", "Ephesians", "NT", ["eph"]),
  b("PHP", "Philippians", "NT", ["phil", "php"]),
  b("COL", "Colossians", "NT", ["col"]),
  b("1TH", "1 Thessalonians", "NT", ["1 thess", "1 thes", "1thess"]),
  b("2TH", "2 Thessalonians", "NT", ["2 thess", "2 thes", "2thess"]),
  b("1TI", "1 Timothy", "NT", ["1 tim", "1 tm", "1tim"]),
  b("2TI", "2 Timothy", "NT", ["2 tim", "2 tm", "2tim"]),
  b("TIT", "Titus", "NT", ["ti", "tit"]),
  b("PHM", "Philemon", "NT", ["phlm", "philem"]),
  b("HEB", "Hebrews", "NT", ["heb"]),
  b("JAS", "James", "NT", ["jas", "jam"]),
  b("1PE", "1 Peter", "NT", ["1 pet", "1 pt", "1pet"]),
  b("2PE", "2 Peter", "NT", ["2 pet", "2 pt", "2pet"]),
  b("1JN", "1 John", "NT", ["1 jn", "1jn", "1 joh"]),
  b("2JN", "2 John", "NT", ["2 jn", "2jn"]),
  b("3JN", "3 John", "NT", ["3 jn", "3jn"]),
  b("JUD", "Jude", "NT", ["jude", "jud"]),
  b("REV", "Revelation", "NT", ["rev", "rv", "apocalypse", "apoc"]),
];

export const BOOK_CODES = CANON.map((x) => x.code);
const BY_CODE = new Map(CANON.map((x) => [x.code, x]));
export const bookByCode = (code: string) => BY_CODE.get(code.toUpperCase());
export const canonIndex = (code: string) => BOOK_CODES.indexOf(code.toUpperCase());

/** USFM ids that differ from our canonical code. */
const USFM_ALIASES: Record<string, string> = { ESG: "EST", DAG: "DAN" };
export const normalizeBookCode = (usfmId: string) => {
  const up = usfmId.toUpperCase();
  const code = USFM_ALIASES[up] ?? up;
  return BY_CODE.has(code) ? code : null;
};

/** "1 Cor." / "First Corinthians" / "I Corinthians" → "1 cor" style key. */
function nameKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/^(first|i)\s+/, "1 ")
    .replace(/^(second|ii)\s+/, "2 ")
    .replace(/^(third|iii)\s+/, "3 ")
    .replace(/^([123])([a-z])/, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

const BY_NAME = new Map<string, string>();
for (const x of CANON) {
  for (const n of [x.name, x.code, ...x.aliases]) BY_NAME.set(nameKey(n), x.code);
}

export const findBook = (name: string) => BY_NAME.get(nameKey(name));

export interface VerseRange {
  chapter: number;
  from: number | null; // null = whole chapter
  to: number | null;
}

export interface ParsedReference {
  book: string;
  ranges: VerseRange[];
}

/**
 * Parses liturgical-style citations:
 *   "Luke 10:13-16" · "Job 38:1, 12-21; 40:3-5" · "Psalm 23" · "1 Jn 3:2" · "Mt 26:14—27:66"
 * Verse suffixes like "12a" are accepted and ignored. Returns null when the book is unknown.
 */
export function parseReference(input: string): ParsedReference | null {
  const text = input.trim().replace(/[–—]/g, "-");
  const m = /^((?:[1-3]|i{1,3})?\s*[a-z][a-z .]*?)\s*(\d.*)?$/i.exec(text);
  if (!m) return null;
  const book = findBook(m[1]!);
  if (!book) return null;
  const rest = (m[2] ?? "").replace(/\s+/g, "");
  if (!rest) return { book, ranges: [{ chapter: 1, from: null, to: null }] };

  const ranges: VerseRange[] = [];
  let chapter = 0;
  for (const part of rest.split(";").filter(Boolean)) {
    for (const piece of part.split(",").filter(Boolean)) {
      const v = (s: string) => Number(s.replace(/[a-z]+$/i, ""));
      let mm: RegExpExecArray | null;
      if ((mm = /^(\d+):(\d+[a-z]?)(?:-(\d+):(\d+[a-z]?))?$/i.exec(piece)) && mm[3]) {
        // cross-chapter range: keep the first chapter (to its end) and the last (from its start)
        chapter = Number(mm[1]);
        ranges.push({ chapter, from: v(mm[2]!), to: null });
        for (let c = chapter + 1; c < Number(mm[3]); c++)
          ranges.push({ chapter: c, from: null, to: null });
        chapter = Number(mm[3]);
        ranges.push({ chapter, from: 1, to: v(mm[4]!) });
      } else if ((mm = /^(\d+):(\d+[a-z]?)(?:-(\d+[a-z]?))?$/i.exec(piece))) {
        chapter = Number(mm[1]);
        ranges.push({ chapter, from: v(mm[2]!), to: mm[3] ? v(mm[3]) : v(mm[2]!) });
      } else if ((mm = /^(\d+[a-z]?)(?:-(\d+[a-z]?))?$/i.exec(piece))) {
        if (chapter === 0) {
          // "Psalm 23" or "Psalm 23-24": whole chapter(s)
          const first = Number(mm[1]);
          const last = mm[2] ? Number(mm[2]) : first;
          for (let c = first; c <= last; c++) ranges.push({ chapter: c, from: null, to: null });
          chapter = last;
        } else {
          ranges.push({ chapter, from: v(mm[1]!), to: mm[2] ? v(mm[2]) : v(mm[1]!) });
        }
      } else {
        return null;
      }
    }
  }
  return ranges.length ? { book, ranges } : null;
}

/** Verses of `chapter` that a parsed reference highlights (empty = none, null = whole chapter). */
export function highlightedVerses(ref: ParsedReference, chapter: number): Set<number> | null {
  const set = new Set<number>();
  for (const r of ref.ranges) {
    if (r.chapter !== chapter) continue;
    if (r.from === null) return null;
    for (let v = r.from; v <= (r.to ?? 999); v++) set.add(v);
  }
  return set;
}

// ------------------------------------------------------------------ Psalm numbering (D-024)
/**
 * Most modern Bibles (and lectionary citations) number the Psalms as in the Hebrew text.
 * The Douay-Rheims follows the Greek/Vulgate numbering, which is one lower for most psalms.
 */
export type PsalmNumbering = "HEBREW" | "VULGATE";

/** Hebrew psalm (and optionally verse) → Vulgate psalm number. */
export function hebrewToVulgatePsalm(psalm: number, verse?: number): number {
  if (psalm <= 8 || psalm >= 148) return psalm;
  if (psalm === 9 || psalm === 10) return 9;
  if (psalm <= 113) return psalm - 1;
  if (psalm === 114 || psalm === 115) return 113;
  if (psalm === 116) return verse !== undefined && verse >= 10 ? 115 : 114;
  if (psalm <= 146) return psalm - 1;
  return verse !== undefined && verse >= 12 ? 147 : 146; // 147
}

/**
 * Chapter to open for a citation in a translation. Returns `exact: false` when the verse
 * numbers may not line up (Vulgate psalms), so the reader should not highlight verses.
 */
export function chapterInTranslation(
  book: string,
  chapter: number,
  numbering: PsalmNumbering,
  firstVerse?: number,
): { chapter: number; exact: boolean } {
  if (book !== "PSA" || numbering === "HEBREW") return { chapter, exact: true };
  return { chapter: hebrewToVulgatePsalm(chapter, firstVerse), exact: false };
}
