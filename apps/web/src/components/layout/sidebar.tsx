import { NavLink } from "react-router-dom";
import { MORE_ITEM, PRIMARY_NAV } from "@/nav";
import { useUi } from "@/stores/ui";
import { Brand } from "./brand";

/**
 * Sidebar: brand, the sections and More — navigation only (docs/social.md §4, S-003).
 * The signed-in person lives in the top bar's account menu (S-004, D-042), so the sidebar
 * looks the same for visitors and members.
 */
export function Sidebar() {
  const { setNavOpen, setMoreOpen } = useUi();
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
    </aside>
  );
}
