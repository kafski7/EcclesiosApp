import {
  LoginChallengeResponseSchema,
  TokenPairSchema,
  VerifyOtpResponseSchema,
  type AccountKind,
  type TokenPair,
} from "@ecclesios/shared";
import { api, queryClient } from "./query";
import { refreshStorage, useSession } from "@/stores/session";

/**
 * Two doors into this app (functionality §2.1–2.2):
 * - "member": church staff → POST /auth/login → Church Management
 * - "user":   platform accounts → POST /auth/admin-login → platform console
 */
let refreshTimer: ReturnType<typeof setTimeout> | undefined;

function adopt(pair: TokenPair) {
  useSession.getState().setSession(pair.accessToken, pair.principal);
  refreshStorage.set(pair.refreshToken);
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(
    () => void restoreSession(),
    Math.max(30, pair.expiresInSeconds - 60) * 1000,
  );
}

export const startSignIn = (kind: AccountKind, identifier: string, password: string) =>
  api.post(
    kind === "user" ? "/auth/admin-login" : "/auth/login",
    { identifier, password },
    LoginChallengeResponseSchema,
  );

export async function verifyCode(challengeToken: string, otp: string) {
  const res = await api.post("/auth/verify-otp", { challengeToken, otp }, VerifyOtpResponseSchema);
  if (res.status === "AUTHENTICATED") adopt(res);
  return res;
}

export async function setFirstPassword(tempToken: string, newPassword: string) {
  const pair = await api.post("/auth/set-password", { tempToken, newPassword }, TokenPairSchema);
  adopt(pair);
  return pair;
}

export async function restoreSession(): Promise<boolean> {
  const refreshToken = refreshStorage.get();
  const s = useSession.getState();
  if (!refreshToken) {
    s.setRestoring(false);
    return false;
  }
  try {
    adopt(await api.post("/auth/refresh", { refreshToken }, TokenPairSchema));
    return true;
  } catch {
    refreshStorage.set(null);
    s.clear();
    return false;
  } finally {
    s.setRestoring(false);
  }
}

export async function signOut() {
  const refreshToken = refreshStorage.get();
  clearTimeout(refreshTimer);
  refreshStorage.set(null);
  useSession.getState().clear();
  queryClient.clear();
  if (refreshToken) await api.postVoid("/auth/logout", { refreshToken }).catch(() => undefined);
}
