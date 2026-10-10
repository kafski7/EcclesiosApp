import { Bell, LogOut, Menu } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { badgeCount } from "@ecclesios/shared/domain";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useUnread } from "@/lib/account";
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
  links,
  children,
}: {
  sidebarTop: ReactNode;
  nav: readonly NavItem[];
  footerNav?: readonly NavItem[];
  user: { name: string; role: string };
  loginPath: string;
  /** Where the bell and the avatar go (D-039). */
  links: { notifications: string; profile: string };
  children: ReactNode;
}) {
  const unread = badgeCount(useUnread().data?.unread ?? 0);
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
          <Link to={links.profile} className="avatar av-36 av-brand" title="Your profile">
            {initials(user.name)}
          </Link>
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
            <Link
              to={links.notifications}
              className="icon-btn"
              aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
            >
              <Bell className="ic" aria-hidden />
              {unread ? <i className="dot-badge">{unread}</i> : null}
            </Link>
            <Link
              to={links.profile}
              className="avatar av-36 av-brand"
              title={`${user.name} · your profile`}
            >
              {initials(user.name)}
            </Link>
          </div>
        </header>
        <main className="content" id="main">
          {children}
        </main>
      </div>
    </div>
  );
}
