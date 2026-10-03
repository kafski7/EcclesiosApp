/**
 * Podcasts (functionality §3.5, D-027). Pure rules: who may publish, who may manage a series,
 * and what an upload may be. Dependency-free.
 */
import type { PlatformPrivilege, PlatformRole } from "./levels.js";
import { youTubeId } from "./hymnal.js";

export const EPISODE_STATUSES = ["DRAFT", "PUBLISHED"] as const;
export type EpisodeStatus = (typeof EPISODE_STATUSES)[number];

export const PODCAST_AUDIO_TYPES = ["audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/aac", "audio/ogg"] as const;
export const PODCAST_COVER_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_EPISODE_BYTES = 200 * 1024 * 1024;
export const MAX_COVER_BYTES = 5 * 1024 * 1024;

/** Who is acting. Members and platform accounts can both hold POST_PODCASTS (D-017, D-027). */
export type PodcastActor =
  | { kind: "user"; id: string; role: PlatformRole; privileges: readonly PlatformPrivilege[] }
  | { kind: "member"; id: string; privileges: readonly PlatformPrivilege[] };

/** Owner of a series: exactly one platform account or one member. */
export interface SeriesOwner {
  ownerUserId: string | null;
  ownerMemberId: string | null;
}

export const isPlatformAdmin = (a: PodcastActor) => a.kind === "user" && a.role === "SUPER_ADMIN";

/** May create a series: Super-Admins (primary publishers) and anyone granted POST_PODCASTS. */
export const canPublishPodcasts = (a: PodcastActor) =>
  isPlatformAdmin(a) || a.privileges.includes("POST_PODCASTS");

/**
 * May edit a series and its episodes: Super-Admins always; the owner while they still hold
 * POST_PODCASTS (revoking the grant freezes their series, it does not delete it).
 */
export function canManageSeries(a: PodcastActor, s: SeriesOwner): boolean {
  if (isPlatformAdmin(a)) return true;
  if (!a.privileges.includes("POST_PODCASTS")) return false;
  return a.kind === "user" ? s.ownerUserId === a.id : s.ownerMemberId === a.id;
}

/**
 * What an episode leads with (D-029). AUDIO = uploaded file; YOUTUBE = embedded player;
 * VIDEO = self-hosted video, reserved for a managed video service later (cannot be chosen yet).
 * An episode may carry both audio and a YouTube link; `mediaKind` says which one is primary.
 */
export const EPISODE_MEDIA_KINDS = ["AUDIO", "YOUTUBE", "VIDEO"] as const;
export type EpisodeMediaKind = (typeof EPISODE_MEDIA_KINDS)[number];
export const SELECTABLE_EPISODE_MEDIA: readonly EpisodeMediaKind[] = ["AUDIO", "YOUTUBE"];

export interface EpisodeMediaState {
  mediaKind: EpisodeMediaKind;
  audioKey: string | null;
  youtubeId: string | null;
}

/** Why an episode can't go live yet, or null if it can: its primary media must be present. */
export function publishBlocker(e: EpisodeMediaState): "AUDIO_REQUIRED" | "YOUTUBE_REQUIRED" | "VIDEO_NOT_AVAILABLE" | null {
  if (e.mediaKind === "AUDIO") return e.audioKey ? null : "AUDIO_REQUIRED";
  if (e.mediaKind === "YOUTUBE") return e.youtubeId ? null : "YOUTUBE_REQUIRED";
  return "VIDEO_NOT_AVAILABLE";
}

/** An episode can go live only once its primary media is attached. */
export function canPublishEpisode(e: EpisodeMediaState): boolean {
  return publishBlocker(e) === null;
}

/** YouTube / YouTube Music link → id, for episodes (same parser as the hymnal). */
export const episodeYouTubeId = youTubeId;

/** Episode extras (D-029): PDF handouts; transcripts are plain text on the episode. */
export const PODCAST_ATTACHMENT_TYPES = ["application/pdf"] as const;
export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
export const MAX_TRANSCRIPT_CHARS = 100_000;

/** "1:02:05" / "4:09" */
export function formatEpisodeDuration(sec: number | null): string {
  if (sec == null || sec < 0) return "";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
