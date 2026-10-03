import type { Principal } from "@ecclesios/shared";
import { create } from "zustand";

/**
 * CMS session (D-012 applies): access token in memory, refresh token in localStorage under its own
 * key, so being signed in to the social platform and the CMS are independent.
 */
const REFRESH_KEY = "ecclesios.cms.refresh";

export const refreshStorage = {
  get: (): string | null => {
    try {
      return localStorage.getItem(REFRESH_KEY);
    } catch {
      return null;
    }
  },
  set: (token: string | null) => {
    try {
      if (token) localStorage.setItem(REFRESH_KEY, token);
      else localStorage.removeItem(REFRESH_KEY);
    } catch {
      /* private mode */
    }
  },
};

interface SessionState {
  accessToken: string | null;
  principal: Principal | null;
  restoring: boolean;
  setSession: (accessToken: string, principal: Principal) => void;
  setRestoring: (restoring: boolean) => void;
  clear: () => void;
}

export const useSession = create<SessionState>((set) => ({
  accessToken: null,
  principal: null,
  restoring: true,
  setSession: (accessToken, principal) => set({ accessToken, principal }),
  setRestoring: (restoring) => set({ restoring }),
  clear: () => set({ accessToken: null, principal: null }),
}));
