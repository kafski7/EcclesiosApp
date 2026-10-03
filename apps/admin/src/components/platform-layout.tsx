import { Link, Outlet } from "react-router-dom";
import { PLATFORM_NAV } from "@/nav";
import { ROLE_LABEL } from "@/lib/cms";
import { useSession } from "@/stores/session";
import { Brand } from "./brand";
import { Shell } from "./shell";

/** Super-Admin console (functionality §2.1). Creators have no console yet (Phase 8). */
export function PlatformLayout() {
  const principal = useSession((s) => s.principal);
  const role = principal?.kind === "user" ? principal.role : "SUPER_ADMIN";
  if (role !== "SUPER_ADMIN")
    return (
      <main className="cms-auth">
        <div className="card cms-auth-card empty">
          <h2>Creator tools are coming</h2>
          <p>Podcast and Explore publishing for creator accounts arrives in a later release.</p>
        </div>
      </main>
    );
  return (
    <Shell
      sidebarTop={
        <Link to="/platform">
          <Brand sub="Platform console" />
        </Link>
      }
      nav={PLATFORM_NAV}
      user={{ name: "Platform admin", role: ROLE_LABEL[role] ?? role }}
      loginPath="/admin-login"
    >
      <Outlet />
    </Shell>
  );
}
