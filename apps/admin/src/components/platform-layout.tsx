import type { ReactNode } from "react";
import { Link, Navigate, Outlet } from "react-router-dom";
import { CREATOR_NAV, PLATFORM_NAV } from "@/nav";
import { ROLE_LABEL } from "@/lib/cms";
import { useSession } from "@/stores/session";
import { Brand } from "./brand";
import { Shell } from "./shell";

const roleOf = (p: ReturnType<typeof useSession.getState>["principal"]) =>
  p?.kind === "user" ? p.role : "SUPER_ADMIN";

/** Platform console (functionality §2.1): full console for Super-Admins, the podcast studio for creators (D-027). */
export function PlatformLayout() {
  const role = roleOf(useSession((s) => s.principal));
  const creator = role === "CREATOR";
  return (
    <Shell
      sidebarTop={
        <Link to="/platform">
          <Brand sub={creator ? "Creator studio" : "Platform console"} />
        </Link>
      }
      nav={creator ? CREATOR_NAV : PLATFORM_NAV}
      user={{ name: creator ? "Creator" : "Platform admin", role: ROLE_LABEL[role] ?? role }}
      loginPath="/admin-login"
    >
      <Outlet />
    </Shell>
  );
}

/** /platform: the overview for Super-Admins; creators land in their studio. */
export function PlatformHome({ overview }: { overview: ReactNode }) {
  const role = roleOf(useSession((s) => s.principal));
  return role === "CREATOR" ? <Navigate to="/platform/podcasts" replace /> : <>{overview}</>;
}
