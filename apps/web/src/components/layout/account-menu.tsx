import {
  Bell,
  Bookmark,
  ChevronDown,
  Church,
  Library,
  LogOut,
  Settings,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { Link, useLocation } from "react-router-dom";
import { signOut } from "@/lib/auth";
import { env } from "@/lib/env";
import { useMe } from "@/lib/me";
import { consoleLink, homeChurchLabel, initials } from "@/lib/social-shell";
import { useSession } from "@/stores/session";

/**
 * Top-right account menu (docs/social.md §6, S-004/S-005, D-042).
 * Replaces the old sidebar user block. Menu-button pattern: Enter/Space/↓ opens and focuses the
 * first item, ↑/↓/Home/End move, Esc closes and returns focus, Tab or an outside click closes.
 */
export function AccountMenu() {
  const principal = useSession((s) => s.principal);
  const me = useMe();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const { pathname } = useLocation();

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  if (!principal) return null;

  const isMember = principal.kind === "member";
  const name = me.data
    ? `${me.data.firstName} ${me.data.lastName}`
    : isMember
      ? "Your account"
      : "Platform account";
  const church = homeChurchLabel(me.data);
  const cms = consoleLink(principal, me.data, env.VITE_ADMIN_URL);

  const items = () =>
    Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
  const focusItem = (i: number) => {
    const list = items();
    if (!list.length) return;
    list[(i + list.length) % list.length]!.focus();
  };
  const openAndFocus = (index: number) => {
    setOpen(true);
    requestAnimationFrame(() => focusItem(index));
  };
  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  };

  const onTriggerKey = (e: ReactKeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openAndFocus(0);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      openAndFocus(-1);
    }
  };

  const onMenuKey = (e: ReactKeyboardEvent) => {
    const list = items();
    const at = list.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusItem(at + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusItem(at - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusItem(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focusItem(-1);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Tab") {
      close(false);
    }
  };

  const Item = ({
    to,
    icon,
    children,
    external = false,
  }: {
    to: string;
    icon: ReactNode;
    children: ReactNode;
    external?: boolean;
  }) =>
    external ? (
      <a
        role="menuitem"
        tabIndex={-1}
        href={to}
        className="acct-item"
        onClick={() => setOpen(false)}
      >
        {icon}
        <span>{children}</span>
      </a>
    ) : (
      <Link
        role="menuitem"
        tabIndex={-1}
        to={to}
        className="acct-item"
        onClick={() => setOpen(false)}
      >
        {icon}
        <span>{children}</span>
      </Link>
    );

  return (
    <div className="acct" ref={wrap}>
      <button
        ref={trigger}
        type="button"
        className="acct-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Account menu for ${name}`}
        onClick={() => (open ? setOpen(false) : openAndFocus(0))}
        onKeyDown={onTriggerKey}
      >
        <span className="avatar av-36 av-brand" aria-hidden>
          {initials(me.data ? name : isMember ? "" : "Platform")}
        </span>
        <span className="acct-name" aria-hidden>
          {me.data ? me.data.firstName : null}
        </span>
        <ChevronDown className="acct-chev" aria-hidden />
      </button>

      {open ? (
        <div
          id={menuId}
          ref={menu}
          className="acct-menu"
          role="menu"
          aria-label="Account"
          onKeyDown={onMenuKey}
        >
          <div className="acct-head" role="presentation">
            <b>{name}</b>
            {church ? <small>{church}</small> : null}
          </div>

          {isMember ? (
            <>
              <Item to="/me" icon={<UserRound className="ic" aria-hidden />}>
                Your profile
              </Item>
              <Item to="/me#churches" icon={<Church className="ic" aria-hidden />}>
                Your churches
              </Item>
              <Item to="/saved" icon={<Bookmark className="ic" aria-hidden />}>
                Saved
              </Item>
              <Item to="/library" icon={<Library className="ic" aria-hidden />}>
                My library
              </Item>
              <Item to="/notifications" icon={<Bell className="ic" aria-hidden />}>
                Notifications
              </Item>
              <Item to="/account" icon={<Settings className="ic" aria-hidden />}>
                Account settings
              </Item>
            </>
          ) : (
            <Item to="/account" icon={<UserRound className="ic" aria-hidden />}>
              Your account
            </Item>
          )}

          {cms ? (
            <>
              <div className="acct-sep" role="separator" />
              <Item to={cms} external icon={<ShieldCheck className="ic" aria-hidden />}>
                Church Management
              </Item>
            </>
          ) : null}

          <div className="acct-sep" role="separator" />
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            className="acct-item"
            onClick={() => {
              setOpen(false);
              void signOut();
            }}
          >
            <LogOut className="ic" aria-hidden />
            <span>Sign out</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
