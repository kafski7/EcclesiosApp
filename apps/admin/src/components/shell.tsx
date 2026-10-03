import { Bell, LogOut, Menu } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import type { NavItem } from "@/nav";
import { signOut } from "@/lib/auth";
import { useUi } from "@/stores/context";
import { initials } from "./brand";

/** Kit app shell from docs/ecclesios-ui/admin.html: dark sidebar + sticky topbar + content (D-019). */
export function Shell({
  sidebarTop,
  nav,
  footerNav = [],
  user,
  loginPath,
  children,
}: {
  sidebarTop: ReactNode;
  nav: readonly NavItem[];
  footerNav?: readonly NavItem[];
  user: { name: string; role: string };
  loginPath: string;
  children: ReactNode;
}) {
  const { navOpen, setNavOpen } = useUi();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  useEffect(() => setNavOpen(false), [pathname, setNavOpen]);

  const out = async () => {
    await signOut();
    navigate(loginPath, { replace: true });
  };
  const item = (i: NavItem) => {
    const Icon = i.icon;
    return (
      <NavLink
        key={i.to}
        to={i.to}
        end={i.to === "/admin" || i.to === "/platform"}
        className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
      >
        <Icon className="ic" aria-hidden />
        <span>{i.label}</span>
      </NavLink>
    );
  };

  return (
    <div className={`shell${navOpen ? " nav-open" : ""}`}>
      <aside className="sidebar" id="cms-sidebar">
        {sidebarTop}
        <nav className="nav" aria-label="Management">
          {nav.map(item)}
          {footerNav.length ? <div className="nav-sep" role="separator" /> : null}
          {footerNav.map(item)}
        </nav>
        <div className="sidebar-user">
          <span className="avatar av-36 av-brand">{initials(user.name)}</span>
          <span className="s-user-meta">
            <b>{user.name}</b>
            <small>{user.role}</small>
          </span>
          <button type="button" onClick={() => void out()} aria-label="Sign out" title="Sign out">
            <LogOut className="ic" aria-hidden />
          </button>
        </div>
      </aside>
      <div className="scrim" onClick={() => setNavOpen(false)} aria-hidden />
      <div className="main">
        <header className="topbar">
          <button
            type="button"
            className="hamburger"
            aria-label="Open navigation"
            aria-controls="cms-sidebar"
            aria-expanded={navOpen}
            onClick={() => setNavOpen(true)}
          >
            <Menu className="ic" aria-hidden />
          </button>
          <div className="top-actions">
            <button type="button" className="icon-btn" aria-label="Notifications" disabled>
              <Bell className="ic" aria-hidden />
            </button>
            <span className="avatar av-36 av-brand" title={user.name}>
              {initials(user.name)}
            </span>
          </div>
        </header>
        <main className="content" id="main">
          {children}
        </main>
      </div>
    </div>
  );
}
