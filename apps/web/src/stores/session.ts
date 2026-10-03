import type { Principal } from "@ecclesios/shared";
import { create } from "zustand";

/**
 * Signed-in state (D-012).
 * - Access token: memory only (15 min).
 * - Refresh token: localStorage, so an installed PWA stays signed in. It rotates on every use
 *   and reuse revokes the session (D-007). Moving it to an httpOnly cookie is a Phase 9 item.
 */
const REFRESH_KEY = "ecclesios.refresh";

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
      /* private mode: session lasts for this tab only */
    }
  },
};

interface SessionState {
  accessToken: string | null;
  principal: Principal | null;
  /** True until the first restore attempt finishes (avoids a sign-in flash on reload). */
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
