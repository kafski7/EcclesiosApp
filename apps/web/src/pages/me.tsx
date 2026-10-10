import type { ChurchRef } from "@ecclesios/shared";
import {
  ArrowRightLeft,
  Bell,
  Bookmark,
  Church,
  Home,
  Library,
  Search,
  Settings,
  Star,
  UserRound,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { SignInLink } from "@/components/auth/sign-in-link";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { useOwnProfile } from "@/lib/account";
import { env } from "@/lib/env";
import { useMe } from "@/lib/me";
import { churchRows, followOnly, ROLE_LABEL, useMembershipActions, type ChurchRow } from "@/lib/memberships";
import { initials } from "@/lib/social-shell";
import { errorText } from "@/lib/states";
import { useSession } from "@/stores/session";

/**
 * "You" (docs/social.md §6.3, §9.13, D-049): who you are on Ecclesios, your churches — join
 * status, home church, leave, move your home — the churches you follow, and your shortcuts.
 * Owner-only; public member profiles come with Phase 8. Notifications link here (/me).
 */
export function MePage() {
  const principal = useSession((s) => s.principal);
  const me = useMe();
  const profile = useOwnProfile();
  const { hash } = useLocation();
  const ready = me.isSuccess;
  // "/me#churches" (account menu, banner, church page): scroll there once the list has loaded.
  useEffect(() => {
    if (ready && hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [ready, hash]);

  if (!principal)
    return (
      <div className="content-narrow mx-auto">
        <EmptyState icon={UserRound} title="Your profile">
          <SignInLink /> to see your churches, saved items and library.
        </EmptyState>
      </div>
    );
  if (principal.kind !== "member")
    return (
      <div className="content-narrow mx-auto">
        <EmptyState icon={UserRound} title="Platform account">
          Platform accounts don't belong to churches. Manage your account in the{" "}
          <a className="link" href={`${env.VITE_ADMIN_URL}/platform/profile`}>
            platform console
          </a>
          .
        </EmptyState>
      </div>
    );
  if (me.isPending)
    return (
      <div className="content-narrow mx-auto">
        <Skeleton variant="page" label="Loading your profile" />
      </div>
    );
  if (me.isError)
    return (
      <div className="content-narrow mx-auto">
        <ErrorState title="Your profile could not be loaded" error={me.error} onRetry={() => me.refetch()} retrying={me.isRefetching} />
      </div>
    );

  const d = me.data;
  const name = `${d.firstName} ${d.lastName}`;
  const home = d.memberships.find((m) => m.isHome && m.status === "ACTIVE");
  const photo = profile.data?.photoUrl ?? null;

  return (
    <div className="content-narrow mx-auto you">
      <section className="card you-head">
        {photo ? (
          <img src={photo} alt="" className="you-photo" />
        ) : (
          <span className="avatar av-brand you-photo" aria-hidden>
            {initials(name)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="page-title">{name}</h1>
          <p className="page-sub">
            {home ? (
              <>
                <Home className="ic inline" aria-hidden /> {home.church.name}
              </>
            ) : (
              "No home church yet"
            )}
          </p>
        </div>
        <Link to="/account" className="btn btn-outline btn-sm">
          <Settings className="ic" aria-hidden /> Account settings
        </Link>
      </section>

      <nav className="you-shortcuts" aria-label="Your things">
        <Shortcut to="/saved" icon={<Bookmark className="ic" aria-hidden />} label="Saved" />
        <Shortcut to="/library" icon={<Library className="ic" aria-hidden />} label="My library" />
        <Shortcut to="/notifications" icon={<Bell className="ic" aria-hidden />} label="Notifications" />
      </nav>

      <Churches />
    </div>
  );
}

function Shortcut({ to, icon, label }: { to: string; icon: ReactNode; label: string }) {
  return (
    <Link to={to} className="card you-shortcut">
      {icon}
      <span>{label}</span>
    </Link>
  );
}

/** Your churches + following, with every action the API allows (D-014 – D-016, D-049). */
function Churches() {
  const me = useMe();
  const act = useMembershipActions();
  const rows = churchRows(me.data);
  const follows = followOnly(me.data);
  const transfer = me.data?.homeTransfer ?? null;
  const err = act.join.error ?? act.leave.error ?? act.unfollow.error ?? act.requestHome.error ?? act.cancelHome.error;

  return (
    <section id="churches" className="you-section" aria-labelledby="churches-title">
      <div className="you-section-head">
        <h2 id="churches-title" className="rail-title">
          Your churches
        </h2>
        <Link to="/explore?find=1" className="link small">
          <Search className="ic inline" aria-hidden /> Find a church
        </Link>
      </div>

      {err ? (
        <p className="state-text you-error" role="alert">
          {errorText(err, "That didn't work — please try again.")}
        </p>
      ) : null}

      {transfer ? (
        <div className="card you-transfer" role="status">
          <ArrowRightLeft className="ic" aria-hidden />
          <p className="small" style={{ margin: 0 }}>
            Waiting for <b>{transfer.to.name}</b> to confirm it as your home church
            {transfer.from ? ` (now ${transfer.from.name})` : ""}.
          </p>
          <button type="button" className="btn btn-ghost btn-sm" disabled={act.cancelHome.isPending} onClick={() => act.cancelHome.mutate()}>
            Withdraw
          </button>
        </div>
      ) : null}

      {rows.length ? (
        <ul className="card you-list">
          {rows.map((r) => (
            <ChurchItem key={r.m.id} row={r} act={act} />
          ))}
        </ul>
      ) : (
        <EmptyState icon={Church} title="You haven't joined a church yet">
          Find your parish or outstation and ask to join. Its office confirms members.
        </EmptyState>
      )}

      {follows.length ? (
        <>
          <h3 className="you-subtitle">Following</h3>
          <ul className="card you-list">
            {follows.map((c) => (
              <FollowItem key={c.id} c={c} act={act} />
            ))}
          </ul>
        </>
      ) : null}
      <p className="small muted mt-3">
        Your home church keeps your sacramental records. Moving it needs the new church's approval;
        your current home church is told.
      </p>
    </section>
  );
}

type Actions = ReturnType<typeof useMembershipActions>;

/** One church row. Actions come from the page so their errors show in one place. */
function ChurchItem({ row, act }: { row: ChurchRow; act: Actions }) {
  const { m, transferWaiting, canMakeHome } = row;
  const [ask, setAsk] = useState<null | "leave" | "home">(null);
  const [reason, setReason] = useState("");
  const pending = m.status === "PENDING";

  return (
    <li className="you-item">
      <div className="you-item-main">
        <Link to={`/explore/churches/${m.church.id}`} className="you-item-name">
          {m.church.name}
        </Link>
        <span className="you-badges">
          {m.isHome && !pending ? (
            <span className="chip chip-gold">
              <Home className="ic" aria-hidden /> Home church
            </span>
          ) : null}
          {pending ? <span className="chip">Waiting for approval{m.isHome ? " · home" : ""}</span> : null}
          {transferWaiting ? <span className="chip">Home request waiting</span> : null}
          {!pending ? <span className="small muted">{ROLE_LABEL[m.role]}</span> : null}
        </span>
      </div>

      {ask === null ? (
        <div className="you-actions">
          {canMakeHome ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAsk("home")}>
              Make home church
            </button>
          ) : null}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAsk("leave")}>
            {pending ? "Cancel request" : "Leave"}
          </button>
        </div>
      ) : ask === "leave" ? (
        <div className="you-confirm" role="group" aria-label={`Confirm leaving ${m.church.name}`}>
          <span className="small">
            {pending
              ? `Cancel your request to join ${m.church.name}?`
              : m.isHome
                ? `Leave ${m.church.name}? It's your home church — you'll have none until you join or move one.`
                : `Leave ${m.church.name}? You can ask to join again later.`}
          </span>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={act.leave.isPending}
            onClick={() => act.leave.mutate(m.church.id, { onSuccess: () => setAsk(null) })}
          >
            {pending ? "Cancel request" : "Leave"}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAsk(null)}>
            Keep
          </button>
        </div>
      ) : (
        <form
          className="you-confirm"
          onSubmit={(e) => {
            e.preventDefault();
            act.requestHome.mutate(
              { toGroupId: m.church.id, reason: reason.trim() || undefined },
              { onSuccess: () => (setAsk(null), setReason("")) },
            );
          }}
        >
          <span className="small">
            Ask {m.church.name} to become your home church? Its office approves the move.
          </span>
          <input
            className="field-input"
            maxLength={500}
            placeholder="Reason (optional), e.g. we moved house"
            aria-label="Reason (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button type="submit" className="btn btn-primary btn-sm" disabled={act.requestHome.isPending}>
            Send request
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAsk(null)}>
            Cancel
          </button>
        </form>
      )}
    </li>
  );
}

function FollowItem({ c, act }: { c: ChurchRef; act: Actions }) {
  return (
    <li className="you-item">
      <div className="you-item-main">
        <Link to={`/explore/churches/${c.id}`} className="you-item-name">
          {c.name}
        </Link>
        <span className="you-badges">
          <Star className="ic" aria-hidden /> <span className="small muted">Following</span>
        </span>
      </div>
      <div className="you-actions">
        <button type="button" className="btn btn-ghost btn-sm" disabled={act.unfollow.isPending} onClick={() => act.unfollow.mutate(c.id)}>
          Unfollow
        </button>
      </div>
    </li>
  );
}
