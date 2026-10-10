import type { Episode } from "@ecclesios/shared";

/** What the mini-player needs to show and resume a track (D-029). */
export interface Track {
  episodeId: string;
  title: string;
  podcastTitle: string;
  podcastSlug: string;
  coverUrl: string | null;
  durationSec: number | null;
}

/** Which buttons an episode row offers. Locked episodes offer none (badge instead). */
export function episodeActions(
  e: Pick<Episode, "mediaKind" | "hasAudio" | "youtubeId" | "available">,
) {
  if (!e.available) return { listen: false, watch: false, locked: true, primary: null };
  const listen = e.hasAudio;
  const watch = Boolean(e.youtubeId);
  const primary =
    e.mediaKind === "YOUTUBE" && watch ? "watch" : listen ? "listen" : watch ? "watch" : null;
  return { listen, watch, locked: false, primary } as const;
}

/** 0:05 · 12:30 · 1:02:05 */
export function formatClock(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

/** Seek within [0, duration]. */
export const clampSeek = (pos: number, delta: number, duration: number) =>
  Math.min(
    Math.max(0, pos + delta),
    Number.isFinite(duration) && duration > 0 ? duration : pos + Math.max(delta, 0),
  );

/** Don't resume the last few seconds — start over instead. */
export const resumePosition = (saved: number, duration: number | null) =>
  duration && saved > duration - 15 ? 0 : Math.max(0, saved);
