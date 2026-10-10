import {
  LoginChallengeResponseSchema,
  ChurchSearchResponseSchema,
  MeResponseSchema,
  RegisterResponseSchema,
  TokenPairSchema,
  VerifyOtpResponseSchema,
  type RegisterRequest,
  type TokenPair,
} from "@ecclesios/shared";
import { api } from "./query";
import { refreshStorage, useSession } from "@/stores/session";

/** Member sign-in and sign-up against /api/auth (functionality §2.2–2.4). */

let refreshTimer: ReturnType<typeof setTimeout> | undefined;

function adopt(pair: TokenPair) {
  useSession.getState().setSession(pair.accessToken, pair.principal);
  refreshStorage.set(pair.refreshToken);
  // Renew a minute before the access token expires.
  clearTimeout(refreshTimer);
  const ms = Math.max(30, pair.expiresInSeconds - 60) * 1000;
  refreshTimer = setTimeout(() => void restoreSession(), ms);
}

export const startSignIn = (identifier: string, password: string) =>
  api.post("/auth/login", { identifier, password }, LoginChallengeResponseSchema);

/** Claim the record your church created (D-039): code to your phone/email, then set a password. */
export const startClaim = (identifier: string) =>
  api.post("/auth/claim", { identifier }, LoginChallengeResponseSchema);

/** Change your own password (D-039); other sessions end, this one continues. */
export async function changePassword(currentPassword: string, newPassword: string) {
  const pair = await api.post("/me/password", { currentPassword, newPassword }, TokenPairSchema);
  adopt(pair);
  return pair;
}

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

/** Called on app start and before the access token expires. Signs out silently on failure. */
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
  if (refreshToken) await api.postVoid("/auth/logout", { refreshToken }).catch(() => undefined);
}

export const searchChurches = (q: string) =>
  api.get(`/public/churches?q=${encodeURIComponent(q)}`, ChurchSearchResponseSchema);

/** The signed-in person, their churches and follows (D-014). */
export const fetchMe = () => api.get("/me", MeResponseSchema);

export const register = (body: RegisterRequest) =>
  api.post("/auth/register", body, RegisterResponseSchema);
