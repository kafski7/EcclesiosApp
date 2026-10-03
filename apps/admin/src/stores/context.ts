import { create } from "zustand";

/** The church currently selected in the CMS (functionality §4.13). Remembered per browser. */
const KEY = "ecclesios.cms.group";

const read = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

interface ContextState {
  groupId: string | null;
  setGroupId: (id: string) => void;
}

export const useCmsContext = create<ContextState>((set) => ({
  groupId: read(),
  setGroupId: (groupId) => {
    try {
      localStorage.setItem(KEY, groupId);
    } catch {
      /* ignore */
    }
    set({ groupId });
  },
}));

export const useUi = create<{ navOpen: boolean; setNavOpen: (v: boolean) => void }>((set) => ({
  navOpen: false,
  setNavOpen: (navOpen) => set({ navOpen }),
}));
