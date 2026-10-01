import type { Principal } from "@ecclesios/shared";
import { create } from "zustand";

/**
 * Signed-in state. Kept in memory only for now: tokens are never written to localStorage.
 * Persisting the refresh token (httpOnly cookie vs. storage) is decided with the sign-in UI.
 */
interface SessionState {
  accessToken: string | null;
  principal: Principal | null;
  setSession: (accessToken: string, principal: Principal) => void;
  clear: () => void;
}

export const useSession = create<SessionState>((set) => ({
  accessToken: null,
  principal: null,
  setSession: (accessToken, principal) => set({ accessToken, principal }),
  clear: () => set({ accessToken: null, principal: null }),
}));
