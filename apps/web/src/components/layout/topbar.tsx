import { Bell, Menu, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { useSession } from "@/stores/session";
import { useUi } from "@/stores/ui";

/** Kit .topbar: hamburger (≤980px), search, notifications and account. */
export function Topbar() {
  const { navOpen, setNavOpen } = useUi();
  const principal = useSession((s) => s.principal);

  return (
    <header className="topbar">
      <button
        type="button"
        className="hamburger"
        aria-label="Open menu"
        aria-controls="app-sidebar"
        aria-expanded={navOpen}
        onClick={() => setNavOpen(true)}
      >
        <Menu className="ic" />
      </button>

      {/* One app-wide search → a results page across every section: Phase 9 (todo "Global search"). */}
      <form className="search" role="search" onSubmit={(e) => e.preventDefault()}>
        <Search className="ic" aria-hidden />
        <input type="search" placeholder="Search readings, saints, hymns…" aria-label="Search" />
      </form>

      <div className="top-actions">
        <Link to="/notifications" className="icon-btn" aria-label="Notifications">
          <Bell className="ic" />
        </Link>
        {principal ? null : (
          <Link to="/login" className="btn btn-primary btn-sm">
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
