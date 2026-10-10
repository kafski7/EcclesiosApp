/**
 * Hymnal rules (functionality §3.6, D-026). Pure and dependency-free.
 * A hymn has no number of its own: numbers belong to hymn BOOKS (NCH 512, CH 246…),
 * so the same hymn can carry different numbers in different countries.
 */

export const MEDIA_KINDS = ["AUDIO", "MIDI", "STAFF_PDF", "SOLFA_PDF", "YOUTUBE"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export const ACCESS_LEVELS_MEDIA = ["FREE", "SUBSCRIBER"] as const;
export type MediaAccess = (typeof ACCESS_LEVELS_MEDIA)[number];

/** Uploaded kinds live in object storage; YOUTUBE is an external link. */
export const isUploadKind = (k: MediaKind) => k !== "YOUTUBE";

/** Allowed upload content types per kind (validated on presign and on confirm). */
export const MEDIA_CONTENT_TYPES: Record<Exclude<MediaKind, "YOUTUBE">, readonly string[]> = {
  AUDIO: ["audio/mpeg", "audio/mp4", "audio/aac", "audio/ogg", "audio/wav", "audio/x-m4a"],
  MIDI: ["audio/midi", "audio/x-midi"],
  STAFF_PDF: ["application/pdf"],
  SOLFA_PDF: ["application/pdf"],
};
export const MAX_UPLOAD_BYTES: Record<Exclude<MediaKind, "YOUTUBE">, number> = {
  AUDIO: 40 * 1024 * 1024,
  MIDI: 2 * 1024 * 1024,
  STAFF_PDF: 20 * 1024 * 1024,
  SOLFA_PDF: 20 * 1024 * 1024,
};

/**
 * Default access when an item is added (D-026): MIDI and the default recording are free;
 * notations, extra recordings and YouTube links are for subscribers. Admins may override per item.
 */
export function defaultMediaAccess(kind: MediaKind, isDefaultRecording: boolean): MediaAccess {
  if (kind === "MIDI") return "FREE";
  if (kind === "AUDIO" && isDefaultRecording) return "FREE";
  return "SUBSCRIBER";
}

export interface MediaViewer {
  /** Personal (listener) subscription — arrives with personal plans (later phase). */
  subscribed: boolean;
  /** Platform staff see everything. */
  staff: boolean;
}

/**
 * May this viewer open the item? `paywall` is the platform switch: while personal plans
 * don't exist it is OFF and everything is open (D-026).
 */
export function canOpenMedia(access: MediaAccess, viewer: MediaViewer, paywall: boolean): boolean {
  if (access === "FREE" || !paywall) return true;
  return viewer.staff || viewer.subscribed;
}

/**
 * YouTube / YouTube Music link → video id, or null. Accepts watch, youtu.be, shorts, embed,
 * music.youtube.com and bare 11-character ids.
 */
export function youTubeId(input: string): string | null {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  // No URL global here (shared runs in browsers, Node and React Native alike) — plain patterns.
  const m =
    /^https?:\/\/(?:www\.|m\.)?youtu\.be\/([\w-]{11})(?:[?#/]|$)/i.exec(s) ??
    /^https?:\/\/(?:www\.|m\.|music\.)?youtube(?:-nocookie)?\.com\/watch\?(?:[^#]*&)?v=([\w-]{11})(?:[&#]|$)/i.exec(
      s,
    ) ??
    /^https?:\/\/(?:www\.|m\.|music\.)?youtube(?:-nocookie)?\.com\/(?:embed|shorts|live|v)\/([\w-]{11})(?:[?#/]|$)/i.exec(
      s,
    );
  return m ? m[1]! : null;
}

/** Privacy-friendly embed URL (YouTube's terms: the player stays visible). */
export const youTubeEmbedUrl = (id: string) => `https://www.youtube-nocookie.com/embed/${id}`;

// ------------------------------------------------------------------ search

export interface HymnQuery {
  /** Book code if the user typed one, e.g. "NCH 512" → NCH. */
  book: string | null;
  /** Hymn number text, e.g. "512" or "246a". */
  number: string | null;
  /** Remaining words for title / first line / lyrics search. */
  text: string;
}

/**
 * Splits what the user typed. `bookCodes` maps lower-case aliases → book code
 * ({"nch": "NCH", "new": "NCH", "ch": "CH", "ghana": "CH"}).
 *   "512" → number · "NCH 512" / "nch512" → book + number · "holy god" → text
 */
export function parseHymnQuery(input: string, bookCodes: Record<string, string>): HymnQuery {
  const q = input.trim().replace(/\s+/g, " ");
  if (!q) return { book: null, number: null, text: "" };
  const m = /^([a-z][a-z .]*?)\s*#?\s*(\d{1,4}[a-z]?)$/i.exec(q);
  if (m) {
    const book = bookCodes[m[1]!.toLowerCase().replace(/\./g, "").trim()];
    if (book) return { book, number: normalizeHymnNumber(m[2]!), text: "" };
  }
  const n = /^#?\s*(\d{1,4}[a-z]?)$/i.exec(q);
  if (n) return { book: null, number: normalizeHymnNumber(n[1]!), text: "" };
  return { book: null, number: null, text: q };
}

/** "0512" → "512", "246A" → "246a". */
export const normalizeHymnNumber = (n: string) =>
  n
    .trim()
    .toLowerCase()
    .replace(/^0+(?=\d)/, "");

/** Sort key so 2 < 10 < 10a < 11. */
export function hymnNumberKey(n: string): number {
  const m = /^(\d+)([a-z]?)$/.exec(normalizeHymnNumber(n));
  if (!m) return Number.MAX_SAFE_INTEGER;
  return Number(m[1]) * 100 + (m[2] ? m[2].charCodeAt(0) - 96 : 0);
}

/**
 * Orders a hymn's book numbers for display: the reader's country first, then by book order.
 */
export function orderBookNumbers<T extends { bookCountry: string | null; bookOrder: number }>(
  rows: readonly T[],
  country: string | null,
): T[] {
  return [...rows].sort(
    (a, b) =>
      Number(b.bookCountry === country) - Number(a.bookCountry === country) ||
      a.bookOrder - b.bookOrder,
  );
}

/** Title used for display: explicit title, else the first line without trailing punctuation. */
export const hymnDisplayTitle = (title: string | null, firstLine: string) =>
  title?.trim() || firstLine.replace(/[,;:.!]+$/, "").trim();
