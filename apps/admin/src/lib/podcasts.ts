import {
  PresignedUploadSchema,
  StudioPodcastListSchema,
  StudioPodcastSchema,
  type StudioPodcast,
  type UpsertEpisode,
  type UpsertPodcast,
} from "@ecclesios/shared";
import { PODCAST_AUDIO_TYPES, PODCAST_COVER_TYPES, type EpisodeStatus } from "@ecclesios/shared/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./query";

/** Publishing studio (D-027) — Super-Admins see every series, creators their own. */
const base = "/studio/podcasts";

export function useStudioPodcasts() {
  return useQuery({ queryKey: ["studio", "podcasts"], queryFn: () => api.get(base, StudioPodcastListSchema) });
}

export function useStudioPodcast(slug: string | undefined) {
  return useQuery({
    queryKey: ["studio", "podcast", slug],
    queryFn: () => api.get(`${base}/${slug}`, StudioPodcastSchema),
    enabled: !!slug,
  });
}

function useStudioMutation<V>(fn: (v: V) => Promise<StudioPodcast>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (p) => {
      qc.setQueryData(["studio", "podcast", p.slug], p);
      void qc.invalidateQueries({ queryKey: ["studio", "podcasts"] });
    },
  });
}

export const useSavePodcast = (slug: string | undefined) =>
  useStudioMutation((body: UpsertPodcast) =>
    slug ? api.put(`${base}/${slug}`, body, StudioPodcastSchema) : api.post(base, body, StudioPodcastSchema),
  );

export const useAddEpisode = (slug: string) =>
  useStudioMutation((body: UpsertEpisode) => api.post(`${base}/${slug}/episodes`, body, StudioPodcastSchema));

export const useUpdateEpisode = (slug: string) =>
  useStudioMutation(({ id, body }: { id: string; body: UpsertEpisode }) =>
    api.put(`${base}/${slug}/episodes/${id}`, body, StudioPodcastSchema),
  );

export const useEpisodeStatus = (slug: string) =>
  useStudioMutation(({ id, status }: { id: string; status: EpisodeStatus }) =>
    api.post(`${base}/${slug}/episodes/${id}/status`, { status }, StudioPodcastSchema),
  );

export const useRemoveEpisode = (slug: string) =>
  useStudioMutation((id: string) => api.del(`${base}/${slug}/episodes/${id}`, StudioPodcastSchema));

/** Browser → storage directly (presigned PUT), then register the key (blueprint §5). */
async function putFile(url: string, headers: Record<string, string>, file: File) {
  const r = await fetch(url, { method: "PUT", headers, body: file });
  if (!r.ok) throw new Error(`Upload failed (${r.status})`);
}

export const audioType = (file: { type: string; name: string }) => {
  if ((PODCAST_AUDIO_TYPES as readonly string[]).includes(file.type)) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  return ({ mp3: "audio/mpeg", m4a: "audio/mp4", aac: "audio/aac", ogg: "audio/ogg" } as Record<string, string>)[ext ?? ""] ?? file.type;
};

export const isCoverType = (t: string) => (PODCAST_COVER_TYPES as readonly string[]).includes(t);

export const useUploadAudio = (slug: string) =>
  useStudioMutation(async ({ id, file }: { id: string; file: File }) => {
    const contentType = audioType(file);
    const signed = await api.post(`${base}/${slug}/episodes/${id}/upload`, { contentType, bytes: file.size }, PresignedUploadSchema);
    await putFile(signed.url, signed.headers, file);
    return api.put(`${base}/${slug}/episodes/${id}/audio`, { key: signed.key, durationSec: await duration(file) }, StudioPodcastSchema);
  });

/** YouTube / YouTube Music link (D-029); null clears it. */
export const useSetYouTube = (slug: string) =>
  useStudioMutation(({ id, url }: { id: string; url: string | null }) =>
    api.put(`${base}/${slug}/episodes/${id}/youtube`, { url }, StudioPodcastSchema),
  );

/** PDF handout: presigned PUT, then register with a label (D-029). */
export const useAddHandout = (slug: string) =>
  useStudioMutation(async ({ id, file, label }: { id: string; file: File; label: string }) => {
    const signed = await api.post(
      `${base}/${slug}/episodes/${id}/attachment-upload`,
      { contentType: "application/pdf", bytes: file.size },
      PresignedUploadSchema,
    );
    await putFile(signed.url, signed.headers, file);
    return api.post(`${base}/${slug}/episodes/${id}/attachments`, { key: signed.key, label }, StudioPodcastSchema);
  });

export const useRemoveHandout = (slug: string) =>
  useStudioMutation((attachmentId: string) => api.del(`${base}/${slug}/attachments/${attachmentId}`, StudioPodcastSchema));

/** Handout label from a file name: "Week 3 notes.pdf" → "Week 3 notes". */
export const handoutLabel = (name: string) => name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim().slice(0, 80) || "Handout";

export const useUploadCover = (slug: string) =>
  useStudioMutation(async (file: File | null) => {
    if (!file) return api.put(`${base}/${slug}/cover`, { key: null }, StudioPodcastSchema);
    const signed = await api.post(`${base}/${slug}/cover-upload`, { contentType: file.type, bytes: file.size }, PresignedUploadSchema);
    await putFile(signed.url, signed.headers, file);
    return api.put(`${base}/${slug}/cover`, { key: signed.key }, StudioPodcastSchema);
  });

function duration(file: File): Promise<number | null> {
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
