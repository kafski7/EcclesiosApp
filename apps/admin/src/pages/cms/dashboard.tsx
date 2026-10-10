import { CAlert } from "@coreui/react";
import { Bell, BookUser, Cake, Network, UserPlus, UsersRound, type LucideIcon } from "lucide-react";
import { FinanceCard } from "./collections";
import { Link } from "react-router-dom";
import { StateBadge } from "@/components/brand";
import { formatDate, LEVEL_LABEL, useCurrent, useDashboard } from "@/lib/cms";

/** Dashboard in the kit's admin.html layout (functionality §4.1). Society-Leaders get their own view (D-039). */
export function DashboardPage() {
  const ctx = useCurrent();
  const d = useDashboard(ctx.group.id);
  const s = ctx.subscription;
  const v = (n: number | undefined) => (d.isPending ? "…" : (n ?? 0).toLocaleString());
  if (d.data?.view === "LEADER")
    return (
      <LeaderDashboard
        societies={d.data.societies}
        committees={d.data.committees}
        unread={d.data.unreadNotifications}
      />
    );

  return (
    <>
      <div className="dash-head">
        <div>
          <h1>Dashboard</h1>
          <p className="dash-sub">
            {ctx.group.name} · {LEVEL_LABEL[ctx.group.level]}
            {ctx.group.parent ? ` of ${ctx.group.parent}` : ""}
          </p>
        </div>
      </div>
      {d.isError ? <CAlert color="danger">The dashboard could not be loaded.</CAlert> : null}

      <section className="stats-grid" aria-label="Church statistics">
        <Stat tone="info" icon={BookUser} value={v(d.data?.members)} label="Members" />
        <Stat
          tone="ok"
          icon={UsersRound}
          value={v(d.data?.societies)}
          label="Societies"
          note={`${v(d.data?.committees)} committees`}
        />
        <Stat
          tone="gold"
          icon={Cake}
          value={v(d.data?.birthdaysToday)}
          label="Birthdays"
          note="Today"
          noteTone="gold"
        />
        <Stat
          tone="danger"
          icon={Bell}
          value={v(d.data?.unreadNotifications)}
          label="Notifications"
          note="Unread"
          noteTone="red"
        />
      </section>

      {d.data?.rollup ? (
        <section className="stats-grid" aria-label="Everything below">
          {ctx.group.level !== "PARISH" ? (
            <Stat tone="info" icon={Network} value={v(d.data.rollup.parishes)} label="Parishes" />
          ) : null}
          <Stat tone="ok" icon={Network} value={v(d.data.rollup.outstations)} label="Outstations" />
          <Stat
            tone="gold"
            icon={BookUser}
            value={v(d.data.rollup.members)}
            label="Members"
            note={ctx.group.level === "PARISH" ? "With outstations" : "All levels below"}
            noteTone="gold"
          />
          <Stat
            tone="danger"
            icon={UserPlus}
            value={v(d.data.rollup.pendingRequests)}
            label="Waiting to join"
            note="All levels below"
            noteTone="red"
          />
        </section>
      ) : null}
      {d.data?.rollup?.hiddenDioceses ? (
        <p className="small muted">
          {d.data.rollup.hiddenDioceses} suffragan{" "}
          {d.data.rollup.hiddenDioceses === 1 ? "diocese has" : "dioceses have"} chosen not to share
          figures; they're left out.
        </p>
      ) : null}
      {(ctx.group.level === "PARISH" || ctx.group.level === "OUTSTATION") &&
      (ctx.role === "ADMINISTRATOR" || ctx.role === "MANAGER") ? (
        <FinanceCard groupId={ctx.group.id} />
      ) : null}

      <div className="dash-grid">
        <section className="card panel">
          <header className="panel-head">
            <h2 className="panel-title">Membership requests</h2>
          </header>
          {d.data && d.data.pendingRequests > 0 ? (
            <p className="small">
              <UserPlus className="ic" style={{ display: "inline", marginRight: 8 }} aria-hidden />
              <b>{d.data.pendingRequests}</b>{" "}
              {d.data.pendingRequests === 1 ? "person is" : "people are"} waiting to join{" "}
              {ctx.group.name}.{" "}
              <Link className="link" to="/admin/members/requests">
                Review requests
              </Link>
            </p>
          ) : (
            <p className="small muted">No one is waiting to join.</p>
          )}
        </section>

        <aside className="dash-side">
          <section className="card panel">
            <header className="panel-head">
              <h2 className="panel-title">Subscription</h2>
              {ctx.role === "ADMINISTRATOR" && ctx.group.level === "PARISH" ? (
                <Link className="link" to="/admin/billing">
                  Billing
                </Link>
              ) : null}
            </header>
            {s ? (
              <div className="d-flex flex-column gap-2 small">
                <span>
                  <StateBadge state={s.state} />{" "}
                  {s.plan ? <b className="ms-2">{s.plan.name}</b> : null}
                </span>
                <span className="muted">
                  {s.holder.id === ctx.group.id ? "" : `Held by ${s.holder.name} · `}
                  {s.expiresAt ? `Renews ${formatDate(s.expiresAt)}` : ""}
                </span>
                <span className="muted">{s.smsBalance.toLocaleString()} SMS credits</span>
              </div>
            ) : (
              <p className="small muted">Monitoring offices don't need a subscription.</p>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}

/** Society-Leaders see what they lead, not the church's figures (D-039). */
function LeaderDashboard({
  societies,
  committees,
  unread,
}: {
  societies: number;
  committees: number;
  unread: number;
}) {
  const ctx = useCurrent();
  return (
    <>
      <div className="dash-head">
        <div>
          <h1>Dashboard</h1>
          <p className="dash-sub">{ctx.group.name} · Society-Leader</p>
        </div>
      </div>
      <section className="stats-grid" aria-label="What you lead">
        <Stat tone="ok" icon={UsersRound} value={String(societies)} label="Societies you lead" />
        <Stat
          tone="info"
          icon={UsersRound}
          value={String(committees)}
          label="Committees you lead"
        />
        <Stat
          tone="danger"
          icon={Bell}
          value={String(unread)}
          label="Notifications"
          note="Unread"
          noteTone="red"
        />
      </section>
      <section className="card panel">
        <p className="small mb-0">
          Keep your rosters up to date in{" "}
          <Link className="link" to="/admin/societies">
            Societies
          </Link>{" "}
          and{" "}
          <Link className="link" to="/admin/committees">
            Committees
          </Link>
          . Messages to your members arrive in a later update.
        </p>
      </section>
    </>
  );
}

function Stat(props: {
  tone: "info" | "ok" | "gold" | "danger";
  icon: LucideIcon;
  value: string;
  label: string;
  note?: string;
  noteTone?: "up" | "gold" | "red";
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
        {props.note ? (
          <span className={`stat-note ${props.noteTone ?? "up"}`}>{props.note}</span>
        ) : null}
      </div>
    </div>
  );
}
