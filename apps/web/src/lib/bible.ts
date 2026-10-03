import {
  BibleBookListSchema,
  BibleChapterSchema,
  BibleSearchResponseSchema,
  BibleTranslationListSchema,
} from "@ecclesios/shared";
import {
  bookByCode,
  chapterInTranslation,
  highlightedVerses,
  parseReference,
  type PsalmNumbering,
} from "@ecclesios/shared/domain";
import { useQuery } from "@tanstack/react-query";
import { ApiClientError } from "./api";
import { loadChapter, saveChapter } from "./bible-offline";
import { api } from "./query";
import { useBiblePrefs } from "@/stores/bible";

export function useTranslations() {
  return useQuery({
    queryKey: ["bible", "translations"],
    queryFn: () => api.get("/public/bible/translations", BibleTranslationListSchema),
    staleTime: 60 * 60_000,
  });
}

/** The chosen translation, falling back to the server default (WEBC). */
export function useActiveTranslation() {
  const chosen = useBiblePrefs((s) => s.translation);
  const list = useTranslations();
  const items = list.data?.items ?? [];
  const active = items.find((t) => t.code === chosen) ?? items.find((t) => t.isDefault) ?? items[0];
  return { active, items, isPending: list.isPending, isError: list.isError };
}

export function useBooks(translation: string | undefined) {
  return useQuery({
    queryKey: ["bible", "books", translation],
    queryFn: () => api.get(`/public/bible/${translation}/books`, BibleBookListSchema),
    enabled: !!translation,
    staleTime: 60 * 60_000,
  });
}

/** A chapter from the API; falls back to the offline copy when the network fails. */
export function useChapter(translation: string | undefined, book: string, chapter: number, offlineAllowed: boolean) {
  return useQuery({
    queryKey: ["bible", "chapter", translation, book, chapter],
    enabled: !!translation,
    staleTime: 24 * 60 * 60_000,
    queryFn: async () => {
      try {
        const c = await api.get(`/public/bible/${translation}/${book}/${chapter}`, BibleChapterSchema);
        if (offlineAllowed) void saveChapter(c);
        return c;
      } catch (err) {
        if (err instanceof ApiClientError && err.code === "NETWORK_ERROR") {
          const cached = await loadChapter(translation!, book, chapter);
          if (cached) return cached;
        }
        throw err;
      }
    },
  });
}

export function useBibleSearch(translation: string | undefined, q: string) {
  return useQuery({
    queryKey: ["bible", "search", translation, q],
    queryFn: () => api.get(`/public/bible/${translation}/search?q=${encodeURIComponent(q)}`, BibleSearchResponseSchema),
    enabled: !!translation && q.trim().length >= 2,
    staleTime: 10 * 60_000,
  });
}

export interface ReaderLocation {
  book: string;
  chapter: number;
  highlight: Set<number> | null;
}

/**
 * Where the reader opens: /bible/:book/:chapter, or /bible?ref=Luke 10:13-16 from Readings,
 * else John 1. Unknown references fall back too.
 */
export function readerLocation(params: { book?: string; chapter?: string }, ref: string | null): ReaderLocation {
  if (ref) {
    const parsed = parseReference(ref);
    if (parsed) {
      const chapter = parsed.ranges[0]!.chapter;
      return { book: parsed.book, chapter, highlight: highlightedVerses(parsed, chapter) };
    }
  }
  const book = params.book && bookByCode(params.book) ? params.book.toUpperCase() : "JHN";
  const chapter = Math.max(1, Number(params.chapter) || 1);
  return { book, chapter, highlight: null };
}

/**
 * A citation (Hebrew psalm numbers) opened in a Vulgate-numbered translation: move to the matching
 * psalm and drop verse highlights, since verse numbers may not line up (D-024). Path navigation is untouched.
 */
export function adjustForTranslation(loc: ReaderLocation, fromCitation: boolean, numbering: PsalmNumbering): ReaderLocation {
  if (!fromCitation) return loc;
  const first = loc.highlight && loc.highlight.size ? Math.min(...loc.highlight) : undefined;
  const { chapter, exact } = chapterInTranslation(loc.book, loc.chapter, numbering, first);
  return exact ? loc : { book: loc.book, chapter, highlight: null };
}

export const chapterPath = (book: string, chapter: number) => `/bible/${book.toLowerCase()}/${chapter}`;

/** Split a verse into plain and words-of-Jesus segments. */
export function verseSegments(text: string, woj: [number, number][]) {
  const out: { text: string; woj: boolean }[] = [];
  let at = 0;
  for (const [a, b] of [...woj].sort((x, y) => x[0] - y[0])) {
    if (a > at) out.push({ text: text.slice(at, a), woj: false });
    out.push({ text: text.slice(a, b), woj: true });
    at = b;
  }
  if (at < text.length) out.push({ text: text.slice(at), woj: false });
  return out;
}
