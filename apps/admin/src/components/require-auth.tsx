import type { AccountKind } from "@ecclesios/shared";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSession } from "@/stores/session";
import { FullPageSpinner } from "./brand";

export const homeOf = (kind: AccountKind) => (kind === "user" ? "/platform" : "/admin");
export const loginOf = (kind: AccountKind) => (kind === "user" ? "/admin-login" : "/login");

/** Members reach /admin, platform accounts reach /platform — never each other's area. */
export function RequireAuth({ kind, children }: { kind: AccountKind; children: ReactNode }) {
  const { principal, restoring } = useSession();
  const location = useLocation();
  if (restoring) return <FullPageSpinner label="Signing you in…" />;
  if (!principal)
    return <Navigate to={loginOf(kind)} replace state={{ from: location.pathname }} />;
  if (principal.kind !== kind) return <Navigate to={homeOf(principal.kind)} replace />;
  return <>{children}</>;
}

/** "/" → wherever the current session belongs. */
export function HomeRedirect() {
  const { principal, restoring } = useSession();
  if (restoring) return <FullPageSpinner />;
  return <Navigate to={principal ? homeOf(principal.kind) : "/login"} replace />;
}
