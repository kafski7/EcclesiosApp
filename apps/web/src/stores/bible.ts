import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Reader preferences, remembered on this device (D-023). null translation = use the server default. */
interface BibleState {
  translation: string | null;
  fontScale: number;
  setTranslation: (code: string) => void;
  setFontScale: (scale: number) => void;
}

export const useBiblePrefs = create<BibleState>()(
  persist(
    (set) => ({
      translation: null,
      fontScale: 1,
      setTranslation: (translation) => set({ translation }),
      setFontScale: (fontScale) => set({ fontScale: Math.min(1.5, Math.max(0.85, fontScale)) }),
    }),
    { name: "ecclesios.bible" },
  ),
);
