import { CAlert } from "@coreui/react";
import type { CmsContext } from "@ecclesios/shared";
import { isCmsOpen } from "@ecclesios/shared/domain";
import { Church, ChevronsUpDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { cmsNav } from "@/nav";
import { ApiClientError } from "@/lib/api";
import { authErrorMessage } from "@/lib/auth-errors";
import { formatDate, LEVEL_LABEL, ROLE_LABEL, useContexts } from "@/lib/cms";
import { useCmsContext } from "@/stores/context";
import { NoContextsPage } from "@/pages/cms/no-contexts";
import { NotSubscribedPage } from "@/pages/cms/not-subscribed";
import { Brand, FullPageSpinner } from "./brand";
import { Shell } from "./shell";

/**
 * Church Management shell (functionality §4): context switcher, role × level sidebar (blueprint §3.3)
 * and the subscription gate (functionality §6, D-020). Billing stays reachable when gated.
 */
export function CmsLayout() {
  const contexts = useContexts();
  const { groupId, setGroupId } = useCmsContext();
  const { pathname } = useLocation();

  if (contexts.isPending) return <FullPageSpinner />;
  if (contexts.isError)
    return (
      <main className="cms-auth">
        <CAlert color="danger">
          {authErrorMessage(contexts.error instanceof ApiClientError ? contexts.error : null)}
        </CAlert>
      </main>
    );

  const { person, contexts: list } = contexts.data;
  const name = `${person.firstName} ${person.lastName}`;
  if (!list.length) return <NoContextsPage name={name} />;

  const current = list.find((c) => c.group.id === groupId) ?? list[0]!;
  const nav = cmsNav(current.role, current.group.level);
  const sub = current.subscription;
  const gated = !!sub && !isCmsOpen(sub.state);
  const onBilling = pathname.startsWith("/admin/billing");

  return (
    <Shell
      sidebarTop={
        <>
          <Link to="/admin">
            <Brand />
          </Link>
          <ContextSwitcher list={list} current={current} onPick={setGroupId} />
        </>
      }
      nav={nav.main}
      footerNav={nav.footer}
      user={{ name, role: ROLE_LABEL[current.role] ?? current.role }}
      loginPath="/login"
    >
      <SubscriptionBanner context={current} />
      {gated && !onBilling ? <NotSubscribedPage context={current} /> : <Outlet context={current} />}
    </Shell>
  );
}

function ContextSwitcher({
  list,
  current,
  onPick,
}: {
  list: CmsContext[];
  current: CmsContext;
  onPick: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (
        e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  const sub = (c: CmsContext) =>
    [LEVEL_LABEL[c.group.level], c.group.parent].filter(Boolean).join(" · ");
  const many = list.length > 1;
  return (
    <div ref={ref}>
      <button
        type="button"
        className="group-switch"
        onClick={() => many && setOpen((o) => !o)}
        aria-haspopup={many ? "listbox" : undefined}
        aria-expanded={many ? open : undefined}
        aria-label={many ? "Switch church" : undefined}
      >
        <Church className="ic" aria-hidden />
        <span>
          <b>{current.group.name}</b>
          <small>{sub(current)}</small>
        </span>
        {many ? <ChevronsUpDown className="ic" aria-hidden /> : null}
      </button>
      {open ? (
        <div className="ctx-menu" role="listbox" aria-label="Your churches">
          {list.map((c) => (
            <button
              key={c.group.id}
              type="button"
              role="option"
              aria-selected={c.group.id === current.group.id}
              aria-current={c.group.id === current.group.id}
              onClick={() => {
                onPick(c.group.id);
                setOpen(false);
              }}
            >
              <b>{c.group.name}</b>
              <small>
                {sub(c)} · {ROLE_LABEL[c.role]}
              </small>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SubscriptionBanner({ context }: { context: CmsContext }) {
  const s = context.subscription;
  if (!s || !isCmsOpen(s.state)) return null;
  if (s.state === "TRIAL")
    return (
      <div className="cms-banner warn" role="status">
        Free trial of the {s.plan?.name} plan for {s.holder.name} — {s.daysLeft} day
        {s.daysLeft === 1 ? "" : "s"} left (ends {formatDate(s.expiresAt)}).
        {context.role === "ADMINISTRATOR" && context.group.level === "PARISH" ? (
          <Link to="/admin/billing" className="btn btn-sm btn-primary">
            Billing
          </Link>
        ) : null}
      </div>
    );
  if (s.expiringSoon)
    return (
      <div className="cms-banner warn" role="status">
        {s.holder.name}'s subscription ends on {formatDate(s.expiresAt)}. Renew to keep Church
        Management open.
      </div>
    );
  return null;
}
