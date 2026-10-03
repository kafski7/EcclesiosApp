import { CAlert } from "@coreui/react";
import { AlarmClock, Church, CreditCard, UserPlus, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { useOverview } from "@/lib/cms";

/** Super-Admin dashboard (todo Phase 4): platform overview + link to subscriptions. */
export function PlatformOverviewPage() {
  const o = useOverview();
  const v = (n: number | undefined) => (o.isPending ? "…" : (n ?? 0).toLocaleString());
  const s = o.data?.subscriptions;
  return (
    <>
      <div className="dash-head">
        <div>
          <h1>Platform overview</h1>
          <p className="dash-sub">Churches, people and subscriptions across Ecclesios.</p>
        </div>
        <Link className="btn btn-primary btn-sm" to="/platform/subscriptions">
          Manage subscriptions
        </Link>
      </div>
      {o.isError ? <CAlert color="danger">The overview could not be loaded.</CAlert> : null}
      <section className="stats-grid" aria-label="Platform statistics">
        <Stat
          tone="info"
          icon={Church}
          value={v(o.data?.churches.parishes)}
          label="Parishes"
          note={`${v(o.data?.churches.outstations)} outstations`}
        />
        <Stat
          tone="ok"
          icon={CreditCard}
          value={v(s ? s.active + s.trial : undefined)}
          label="Subscribed parishes"
          note={`${v(s?.trial)} on trial`}
        />
        <Stat
          tone="danger"
          icon={AlarmClock}
          value={v(s ? s.expired + s.none : undefined)}
          label="Not subscribed"
          note={`${v(s?.expiringSoon)} expiring soon`}
          noteTone="red"
        />
        <Stat
          tone="gold"
          icon={UserPlus}
          value={v(o.data?.people.members)}
          label="People"
          note={`${v(o.data?.people.pendingMemberships)} pending requests`}
          noteTone="gold"
        />
      </section>
      <section className="card panel">
        <header className="panel-head">
          <h2 className="panel-title">Coming next</h2>
        </header>
        <ul className="small muted d-flex flex-column gap-1">
          <li>Explore moderation queue and creator approvals (Phase 5.7 / 8)</li>
          <li>Reference data: themes, plans, currencies, languages (Phase 8)</li>
          <li>Audit-log browser (Phase 8)</li>
        </ul>
      </section>
    </>
  );
}

function Stat(props: {
  tone: string;
  icon: LucideIcon;
  value: string;
  label: string;
  note: string;
  noteTone?: string;
}) {
  const Icon = props.icon;
  return (
    <div className={`card stat stat--${props.tone}`}>
      <span className="stat-ic">
        <Icon className="ic" aria-hidden />
      </span>
      <div>
        <div className="stat-val">{props.value}</div>
        <div className="stat-label">{props.label}</div>
        <span className={`stat-note ${props.noteTone ?? "up"}`}>{props.note}</span>
      </div>
    </div>
  );
}
