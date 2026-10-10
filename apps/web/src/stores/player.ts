import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Track } from "@/lib/player";

/**
 * The persistent mini-player (D-029). One <audio> element lives in the app shell, so playback
 * continues while the listener browses. The track and position survive a reload (not the URL —
 * presigned URLs are short-lived and fetched again).
 */
interface PlayerState {
  track: Track | null;
  /** Bumped to ask the player to (re)load and play the current track. */
  playRequest: number;
  position: number;
  /** When the position last changed (ms) — orders Home's Continue row (D-044). */
  positionAt: number | null;
  open: (track: Track) => void;
  setPosition: (sec: number) => void;
  close: () => void;
}

export const usePlayer = create<PlayerState>()(
  persist(
    (set) => ({
      track: null,
      playRequest: 0,
      position: 0,
      positionAt: null,
      open: (track) =>
        set((s) => ({
          track,
          position: s.track?.episodeId === track.episodeId ? s.position : 0,
          playRequest: s.playRequest + 1,
        })),
      setPosition: (position) => set({ position, positionAt: Date.now() }),
      close: () => set({ track: null, position: 0, positionAt: null }),
    }),
    {
      name: "ecclesios.player",
      partialize: (s) => ({ track: s.track, position: s.position, positionAt: s.positionAt }),
    },
  ),
);
