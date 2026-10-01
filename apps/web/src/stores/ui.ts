import { create } from "zustand";

/** Small client-only UI state (blueprint §6: Zustand for client state, TanStack Query for server state). */
interface UiState {
  /** Phone/tablet: sidebar drawer (kit .shell.nav-open). */
  navOpen: boolean;
  setNavOpen: (open: boolean) => void;
  /** More off-canvas menu (functionality §3.9). */
  moreOpen: boolean;
  setMoreOpen: (open: boolean) => void;
}

export const useUi = create<UiState>((set) => ({
  navOpen: false,
  setNavOpen: (navOpen) => set({ navOpen }),
  moreOpen: false,
  setMoreOpen: (moreOpen) => set({ moreOpen }),
}));
