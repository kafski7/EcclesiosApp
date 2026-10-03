import { HymnBookListSchema, HymnListSchema, HymnSchema, MediaUrlSchema } from "@ecclesios/shared";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api } from "./query";

/** The reader's country from the browser language ("en-GH" → "GH"), used to order book numbers (D-026). */
export function readerCountry(lang = typeof navigator === "undefined" ? "" : navigator.language): string | undefined {
  const m = /^[a-z]{2,3}[-_]([A-Z]{2})\b/i.exec(lang);
  return m ? m[1]!.toUpperCase() : undefined;
}

export interface HymnFilters {
  q: string;
  book: string | null;
  tag: string | null;
}

export const hymnSearchParams = (f: HymnFilters, page: number, country = readerCountry()) => {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.book) p.set("book", f.book);
  if (f.tag) p.set("tag", f.tag);
  if (country) p.set("country", country);
  p.set("page", String(page));
  return p;
};

export function useHymnBooks() {
  return useQuery({
    queryKey: ["hymnal", "books"],
    queryFn: () => api.get("/public/hymnal/books", HymnBookListSchema),
    staleTime: 60 * 60_000,
  });
}

export function useHymnSearch(f: HymnFilters) {
  return useInfiniteQuery({
    queryKey: ["hymnal", "search", f.q.trim(), f.book, f.tag],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => api.get(`/public/hymnal/hymns?${hymnSearchParams(f, pageParam)}`, HymnListSchema),
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    staleTime: 5 * 60_000,
  });
}

export function useHymn(slug: string | undefined) {
  const country = readerCountry();
  return useQuery({
    queryKey: ["hymnal", "hymn", slug],
    queryFn: () => api.get(`/public/hymnal/hymns/${slug}${country ? `?country=${country}` : ""}`, HymnSchema),
    enabled: !!slug,
    staleTime: 10 * 60_000,
  });
}

/** Presigned URLs are short-lived: fetch one right before playing or downloading. */
export const mediaUrl = (id: string, download = false) =>
  api.get(`/public/hymnal/media/${id}/url${download ? "?download=1" : ""}`, MediaUrlSchema);

export const MEDIA_LABEL = {
  AUDIO: "Recording",
  MIDI: "MIDI",
  STAFF_PDF: "Staff notation",
  SOLFA_PDF: "Sol-fa notation",
  YOUTUBE: "YouTube",
} as const;

/** "NCH 56 · CH 12" */
export const numbersLabel = (ns: readonly { book: string; number: string }[]) =>
  ns.map((n) => `${n.book} ${n.number}`).join(" · ");

export const formatDuration = (sec: number | null) =>
  sec == null ? "" : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
