import { LogIn, LogOut } from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import { MORE_ITEM, PRIMARY_NAV } from "@/nav";
import { signOut } from "@/lib/auth";
import { useMe } from "@/lib/me";
import type { MeResponse } from "@ecclesios/shared";
import { useSession } from "@/stores/session";
import { useUi } from "@/stores/ui";
import { Brand } from "./brand";

const initials = (s: string) =>
  s
    .split(/[\s.@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

const homeLabel = (me: MeResponse | undefined) => {
  const home = me?.memberships.find((m) => m.isHome);
  if (!home) return "Ecclesios member";
  return home.status === "PENDING" ? `${home.church.name} · pending` : home.church.name;
};

/** Kit .sidebar: brand, the 9 sections, More, and the signed-in user at the bottom. */
export function Sidebar() {
  const { setNavOpen, setMoreOpen } = useUi();
  const principal = useSession((s) => s.principal);
  const me = useMe();
  const close = () => setNavOpen(false);
  const MoreIcon = MORE_ITEM.icon;

  return (
    <aside className="sidebar" id="app-sidebar" aria-label="Main">
      <Brand onNavigate={close} />

      <nav className="nav" aria-label="Primary">
        {PRIMARY_NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            onClick={close}
            className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
          >
            <Icon className="ic" aria-hidden />
            {label}
          </NavLink>
        ))}
        <div className="nav-sep" role="separator" />
        <button
          type="button"
          className="nav-item"
          aria-haspopup="dialog"
          onClick={() => {
            close();
            setMoreOpen(true);
          }}
        >
          <MoreIcon className="ic" aria-hidden />
          {MORE_ITEM.label}
        </button>
      </nav>

      <div className="sidebar-user">
        {principal ? (
          <>
            <span className="avatar av-36 av-brand" aria-hidden>
              {initials(me.data ? `${me.data.firstName} ${me.data.lastName}` : "Me")}
            </span>
            <span className="s-user-meta">
              <b>{me.data ? `${me.data.firstName} ${me.data.lastName}` : "Signed in"}</b>
              <small>{homeLabel(me.data)}</small>
            </span>
            <button type="button" onClick={() => void signOut()} aria-label="Sign out">
              <LogOut className="ic" />
            </button>
          </>
        ) : (
          <>
            <span className="avatar av-36 av-slate" aria-hidden>
              <LogIn className="ic" style={{ color: "#fff" }} />
            </span>
            <span className="s-user-meta">
              <b>Welcome</b>
              <small>Sign in to connect with your church</small>
            </span>
            <Link to="/login" onClick={close} aria-label="Sign in">
              <LogIn className="ic" />
            </Link>
          </>
        )}
      </div>
    </aside>
  );
}
