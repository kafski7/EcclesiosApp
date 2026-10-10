import { Bell, Menu, Search } from "lucide-react";
import { badgeCount } from "@ecclesios/shared/domain";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useSignInHere } from "@/components/auth/sign-in-link";
import { useUnread } from "@/lib/account";
import { normalizeQuery, searchPath } from "@/lib/social-shell";
import { useSession } from "@/stores/session";
import { useUi } from "@/stores/ui";
import { AccountMenu } from "./account-menu";

/**
 * Top bar (docs/social.md §5, D-042): hamburger (≤980px), the one global search, then
 * notifications and the account menu for signed-in people, or Sign in / Create account.
 */
export function Topbar() {
  const { navOpen, setNavOpen } = useUi();
  const principal = useSession((s) => s.principal);
  const unread = badgeCount(useUnread().data?.unread ?? 0);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const signIn = useSignInHere();
  const register = useSignInHere("/register");

  // Keep the box in step with /search?q= (back/forward, links); clear it elsewhere.
  const urlQ = pathname === "/search" ? normalizeQuery(params.get("q")) : "";
  const [q, setQ] = useState(urlQ);
  useEffect(() => setQ(urlQ), [urlQ]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    navigate(searchPath(q));
  };

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

      <form className="search" role="search" onSubmit={submit}>
        <Search className="ic" aria-hidden />
        <input
          type="search"
          name="q"
          placeholder="Search Ecclesios"
          aria-label="Search Ecclesios"
          enterKeyHint="search"
          maxLength={100}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </form>

      <div className="top-actions">
        {/* Phones: the box is hidden, so search stays one tap away (social.md §8.2). */}
        <Link to="/search" className="icon-btn search-btn" aria-label="Search">
          <Search className="ic" />
        </Link>
        {principal ? (
          <>
            <Link
              to="/notifications"
              className="icon-btn"
              aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
            >
              <Bell className="ic" />
              {unread ? (
                <i className="dot-badge" aria-hidden>
                  {unread}
                </i>
              ) : null}
            </Link>
            <AccountMenu />
          </>
        ) : (
          <>
            <Link to={register} className="btn btn-ghost btn-sm guest-register">
              Create account
            </Link>
            <Link to={signIn} className="btn btn-primary btn-sm">
              Sign in
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
