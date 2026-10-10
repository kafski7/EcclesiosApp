import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { BibleProgress } from "@/lib/continue";

/**
 * Bible preferences, remembered on this device (D-023). null translation = use the server default.
 * Text size moved to stores/reader.ts (D-045), shared by every reading view.
 */
interface BibleState {
  translation: string | null;
  /** The last chapter opened on this device, for Home's Continue row (D-044). */
  lastRead: BibleProgress | null;
  setTranslation: (code: string) => void;
  setLastRead: (p: Omit<BibleProgress, "at">) => void;
}

export const useBiblePrefs = create<BibleState>()(
  persist(
    (set) => ({
      translation: null,
      lastRead: null,
      setTranslation: (translation) => set({ translation }),
      setLastRead: (p) => set({ lastRead: { ...p, at: Date.now() } }),
    }),
    // Drop the old fontScale from saved state (now in "ecclesios.reader").
    {
      name: "ecclesios.bible",
      partialize: (s) => ({ translation: s.translation, lastRead: s.lastRead }),
    },
  ),
);
