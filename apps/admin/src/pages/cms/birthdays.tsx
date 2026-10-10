import { CAlert, CFormSelect, CFormSwitch } from "@coreui/react";
import { Cake, Phone, Send } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { ApiClientError } from "@/lib/api";
import { useCurrent } from "@/lib/cms";
import { useBirthdays, whenLabel } from "@/lib/register";
import { Avatar } from "./members";

/** Today's celebrants and upcoming birthdays (functionality §4.3). Greetings go out through Messages (D-051). */
export function BirthdaysPage() {
  const ctx = useCurrent();
  const [days, setDays] = useState(30);
  const [withOut, setWithOut] = useState(false);
  const q = useBirthdays(ctx.group.id, days, withOut);
  const today = q.data?.items.filter((b) => b.inDays === 0) ?? [];
  const later = q.data?.items.filter((b) => b.inDays > 0) ?? [];
  return (
    <>
      <div className="dash-head">
        <div>
          <h1>Birthdays</h1>
          <p className="dash-sub">{ctx.group.name}</p>
        </div>
        <div className="d-flex gap-3 align-items-center">
          {ctx.group.level === "PARISH" ? (
            <CFormSwitch
              id="bo"
              label="Include outstations"
              checked={withOut}
              onChange={(e) => setWithOut(e.target.checked)}
            />
          ) : null}
          <CFormSelect
            aria-label="Window"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            style={{ width: 160 }}
          >
            <option value={7}>Next 7 days</option>
            <option value={30}>Next 30 days</option>
            <option value={60}>Next 60 days</option>
          </CFormSelect>
        </div>
      </div>
      {q.isError ? (
        <CAlert color="danger">
          {q.error instanceof ApiClientError ? q.error.message : "Could not load birthdays."}
        </CAlert>
      ) : null}

      <section className="card panel mb-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h2 className="panel-title mb-0">
            <Cake className="ic" aria-hidden /> Today
          </h2>
          {today.length && (ctx.role === "ADMINISTRATOR" || ctx.role === "MANAGER") ? (
            <Link to="/admin/messages?compose=birthdays" className="btn btn-sm btn-outline-primary">
              <Send className="ic" aria-hidden /> Send greetings
            </Link>
          ) : null}
        </div>
        {q.isPending ? <p className="muted">Loading…</p> : null}
        {q.data && !today.length ? <p className="small muted mb-0">No birthdays today.</p> : null}
        <div className="bday-grid">
          {today.map((b) => (
            <Link key={b.personId} to={`/admin/members/${b.personId}`} className="bday-card today">
              <Avatar url={b.photoUrl} name={`${b.firstName} ${b.lastName}`} size={48} />
              <span>
                <b>
                  {b.firstName} {b.lastName}
                </b>
                <small className="d-block">
                  Turns {b.turning} today{withOut ? ` · ${b.church}` : ""}
                </small>
                {b.telephone ? (
                  <small className="d-block muted">
                    <Phone className="ic" aria-hidden /> {b.telephone}
                  </small>
                ) : null}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="card panel">
        <h2 className="panel-title mb-3">Coming up</h2>
        {q.data && !later.length ? <p className="small muted mb-0">None in this period.</p> : null}
        <ul className="list-unstyled mb-0">
          {later.map((b) => (
            <li key={b.personId} className="d-flex align-items-center gap-3 py-2 border-bottom">
              <Avatar url={b.photoUrl} name={`${b.firstName} ${b.lastName}`} />
              <Link to={`/admin/members/${b.personId}`} className="flex-grow-1">
                <b>
                  {b.firstName} {b.lastName}
                </b>
                <span className="small muted">
                  {" "}
                  · turns {b.turning}
                  {withOut ? ` · ${b.church}` : ""}
                </span>
              </Link>
              <span className="small">
                {new Date(`${b.dateOfBirth}T12:00:00`).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "long",
                })}
              </span>
              <span className="small muted" style={{ width: 90, textAlign: "right" }}>
                {whenLabel(b.inDays)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
