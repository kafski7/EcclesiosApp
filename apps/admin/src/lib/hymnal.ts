import {
  AdminHymnListSchema,
  AdminHymnSchema,
  PresignedUploadSchema,
  type AddMedia,
  type AdminHymn,
  type UpsertHymn,
  type UpsertTune,
  type Verse,
} from "@ecclesios/shared";
import { MEDIA_CONTENT_TYPES, type MediaKind } from "@ecclesios/shared/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./query";

const base = "/platform/hymnal/hymns";

export function useAdminHymns(q: string) {
  return useQuery({
    queryKey: ["platform", "hymns", q],
    queryFn: () => api.get(`${base}?q=${encodeURIComponent(q)}`, AdminHymnListSchema),
  });
}

export function useAdminHymn(slug: string | undefined) {
  return useQuery({
    queryKey: ["platform", "hymn", slug],
    queryFn: () => api.get(`${base}/${slug}`, AdminHymnSchema),
    enabled: !!slug,
  });
}

/** Every mutation returns the full hymn; store it straight into the cache. */
function useHymnMutation<V>(fn: (v: V) => Promise<AdminHymn>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (h) => {
      qc.setQueryData(["platform", "hymn", h.slug], h);
      void qc.invalidateQueries({ queryKey: ["platform", "hymns"] });
    },
  });
}

export const useSaveHymn = (slug: string | undefined) =>
  useHymnMutation((body: UpsertHymn) =>
    slug
      ? api.put(`${base}/${slug}`, body, AdminHymnSchema)
      : api.post(base, body, AdminHymnSchema),
  );

export const useAddTune = (slug: string) =>
  useHymnMutation((body: UpsertTune) => api.post(`${base}/${slug}/tunes`, body, AdminHymnSchema));
export const useUpdateTune = (slug: string) =>
  useHymnMutation(({ id, body }: { id: string; body: UpsertTune }) =>
    api.put(`${base}/${slug}/tunes/${id}`, body, AdminHymnSchema),
  );
export const useRemoveTune = (slug: string) =>
  useHymnMutation((id: string) => api.del(`${base}/${slug}/tunes/${id}`, AdminHymnSchema));
export const useUpdateMedia = (slug: string) =>
  useHymnMutation(
    ({
      id,
      body,
    }: {
      id: string;
      body: { label?: string; access?: "FREE" | "SUBSCRIBER"; isDefault?: boolean };
    }) => api.patch(`${base}/${slug}/media/${id}`, body, AdminHymnSchema),
  );
export const useRemoveMedia = (slug: string) =>
  useHymnMutation((id: string) => api.del(`${base}/${slug}/media/${id}`, AdminHymnSchema));
export const useAddLink = (slug: string) =>
  useHymnMutation(({ tuneId, body }: { tuneId: string; body: AddMedia }) =>
    api.post(`${base}/${slug}/tunes/${tuneId}/media`, body, AdminHymnSchema),
  );

/**
 * Upload a file straight to object storage (presigned PUT), then register it on the tune.
 * The API never receives the binary (blueprint §5).
 */
export const useUploadMedia = (slug: string) =>
  useHymnMutation(
    async ({
      tuneId,
      kind,
      file,
      label,
      isDefault,
      access,
    }: {
      tuneId: string;
      kind: Exclude<MediaKind, "YOUTUBE">;
      file: File;
      label: string;
      isDefault: boolean;
      access?: "FREE" | "SUBSCRIBER";
    }) => {
      const contentType = fileContentType(file, kind);
      const signed = await api.post(
        `${base}/${slug}/tunes/${tuneId}/uploads`,
        { kind, contentType, bytes: file.size, fileName: file.name },
        PresignedUploadSchema,
      );
      const put = await fetch(signed.url, { method: "PUT", headers: signed.headers, body: file });
      if (!put.ok) throw new Error(`Upload failed (${put.status})`);
      const durationSec = kind === "AUDIO" ? await audioDuration(file) : null;
      return api.post(
        `${base}/${slug}/tunes/${tuneId}/media`,
        { kind, key: signed.key, label, isDefault, access, durationSec },
        AdminHymnSchema,
      );
    },
  );

/** Browsers report MIDI and some audio files with an empty or odd type; fall back on the extension. */
export function fileContentType(
  file: { type: string; name: string },
  kind: Exclude<MediaKind, "YOUTUBE">,
): string {
  const allowed = MEDIA_CONTENT_TYPES[kind];
  if (allowed.includes(file.type)) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  const byExt: Record<string, string> = {
    mp3: "audio/mpeg",
    m4a: "audio/mp4",
    aac: "audio/aac",
    ogg: "audio/ogg",
    wav: "audio/wav",
    mid: "audio/midi",
    midi: "audio/midi",
    pdf: "application/pdf",
  };
  return (ext && byExt[ext]) || file.type || "application/octet-stream";
}

function audioDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const a = document.createElement("audio");
    const url = URL.createObjectURL(file);
    a.preload = "metadata";
    a.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(a.duration) ? Math.max(1, Math.round(a.duration)) : null);
    };
    a.onerror = () => resolve(null);
    a.src = url;
  });
}

// ------------------------------------------------------------------ verse text <-> structure

/**
 * The editor uses plain text: stanzas separated by a blank line; a stanza that starts with
 * "R:" or "R." is the refrain; others are numbered in order.
 */
export function versesFromText(text: string): Verse[] {
  let n = 0;
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((block) =>
      block
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
    )
    .filter((lines) => lines.length)
    .map((lines) => {
      const m = /^R[.:]\s*(.*)$/i.exec(lines[0]!);
      if (m) {
        const rest = m[1] ? [m[1], ...lines.slice(1)] : lines.slice(1);
        return { label: "R", lines: rest.length ? rest : ["…"] };
      }
      n += 1;
      return { label: String(n), lines };
    });
}

export const versesToText = (verses: readonly Verse[]) =>
  verses
    .map((v) => (v.label === "R" ? `R: ${v.lines.join("\n")}` : v.lines.join("\n")))
    .join("\n\n");

/** "NCH 56, CH 12" → [{book, number}] — invalid parts are reported, not dropped silently. */
export function parseNumbers(text: string): {
  numbers: { book: string; number: string }[];
  bad: string[];
} {
  const numbers: { book: string; number: string }[] = [];
  const bad: string[] = [];
  for (const part of text
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean)) {
    const m = /^([A-Za-z][A-Za-z0-9]{0,9}?)\s*#?\s*(\d{1,4}[a-zA-Z]?)$/.exec(part);
    if (m) numbers.push({ book: m[1]!.toUpperCase(), number: m[2]! });
    else bad.push(part);
  }
  return { numbers, bad };
}
