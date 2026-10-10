import { create } from "zustand";
import { persist } from "zustand/middleware";
import { clampScale, migratedScale, stepScale } from "@/lib/reader";

/**
 * Text size for every reading view, remembered on this device (D-045).
 * Replaces the Bible-only size (D-023); the old value is carried over on first use.
 */
interface ReaderState {
  scale: number;
  bigger: () => void;
  smaller: () => void;
  reset: () => void;
}

const readOld = () => {
  try {
    return migratedScale(localStorage.getItem("ecclesios.bible"));
  } catch {
    return 1;
  }
};

export const useReaderPrefs = create<ReaderState>()(
  persist(
    (set) => ({
      scale: readOld(),
      bigger: () => set((s) => ({ scale: stepScale(s.scale, 1) })),
      smaller: () => set((s) => ({ scale: stepScale(s.scale, -1) })),
      reset: () => set({ scale: 1 }),
    }),
    {
      name: "ecclesios.reader",
      partialize: (s) => ({ scale: s.scale }),
      merge: (saved, current) => ({
        ...current,
        scale: clampScale((saved as { scale?: number } | undefined)?.scale ?? current.scale),
      }),
    },
  ),
);
