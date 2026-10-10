import {
  CAlert,
  CBadge,
  CButton,
  CFormInput,
  CFormSelect,
  CFormSwitch,
  CNav,
  CNavItem,
  CNavLink,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from "@coreui/react";
import { MEMBER_ROLES, type MemberRole } from "@ecclesios/shared/domain";
import { Download, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { ApiClientError } from "@/lib/api";
import { formatDate, useCurrent } from "@/lib/cms";
import {
  downloadCsv,
  EMPTY_FILTERS,
  type RegisterFilters,
  ROLE_LABEL,
  useDecide,
  useDecideTransfer,
  useHomeTransfers,
  useRegister,
  useRequests,
} from "@/lib/register";

const errText = (e: unknown) => (e instanceof ApiClientError ? e.message : "Something went wrong.");

export function MembersTabs({ active }: { active: "register" | "requests" }) {
  const ctx = useCurrent();
  const req = useRequests(ctx.group.id);
  const n = req.data?.items.length ?? 0;
  return (
    <CNav variant="underline" className="mb-3">
      <CNavItem>
        <CNavLink as={NavLink} to="/admin/members" end active={active === "register"}>
          Register
        </CNavLink>
      </CNavItem>
      <CNavItem>
        <CNavLink as={NavLink} to="/admin/members/requests" active={active === "requests"}>
          Requests{" "}
          {n ? (
            <CBadge color="danger" className="ms-1">
              {n}
            </CBadge>
          ) : null}
        </CNavLink>
      </CNavItem>
    </CNav>
  );
}

/** The church register (functionality §4.2, D-037). */
export function MembersPage() {
  const ctx = useCurrent();
  const navigate = useNavigate();
  const [f, setF] = useState<RegisterFilters>(EMPTY_FILTERS);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [exportErr, setExportErr] = useState<string | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setF((x) => ({ ...x, q })), 250);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => setPage(1), [f]);
  const list = useRegister(ctx.group.id, f, page);
  const set = <K extends keyof RegisterFilters>(k: K, v: RegisterFilters[K]) =>
    setF((x) => ({ ...x, [k]: v }));
  const isParish = ctx.group.level === "PARISH";

  return (
    <>
      <div className="dash-head">
        <div>
          <h1>Members</h1>
          <p className="dash-sub">
            {ctx.group.name} ·{" "}
            {list.data
              ? `${list.data.total.toLocaleString()} ${f.status === "LEFT" ? "former members" : "members"}`
              : "…"}
          </p>
        </div>
        <div className="d-flex gap-2">
          <CButton
            color="secondary"
            variant="outline"
            onClick={() =>
              downloadCsv(
                ctx.group.id,
                f,
                `${ctx.group.name.replace(/[^\w]+/g, "-").toLowerCase()}-members.csv`,
              ).catch((e) => setExportErr(errText(e)))
            }
          >
            <Download className="ic" aria-hidden /> Export
          </CButton>
          <CButton color="primary" onClick={() => navigate("/admin/members/new")}>
            <UserPlus className="ic" aria-hidden /> Add member
          </CButton>
        </div>
      </div>
      <MembersTabs active="register" />
      {exportErr ? <CAlert color="danger">{exportErr}</CAlert> : null}

      <div className="card panel mb-3">
        <div className="row g-2 align-items-end">
          <div className="col-md-4">
            <CFormInput
              placeholder="Search name, phone or email"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search members"
            />
          </div>
          <div className="col-md-2">
            <CFormSelect
              aria-label="Role"
              value={f.role ?? ""}
              onChange={(e) => set("role", (e.target.value || null) as MemberRole | null)}
            >
              <option value="">All roles</option>
              {MEMBER_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </CFormSelect>
          </div>
          <div className="col-md-2">
            <CFormSelect
              aria-label="Sacraments"
              value={f.missing ?? ""}
              onChange={(e) =>
                set("missing", (e.target.value || null) as RegisterFilters["missing"])
              }
            >
              <option value="">Any sacraments</option>
              <option value="baptism">Not baptised</option>
              <option value="communion">No First Communion</option>
              <option value="confirmation">Not confirmed</option>
            </CFormSelect>
          </div>
          <div className="col-md-2">
            <CFormSelect
              aria-label="Status"
              value={`${f.status}:${f.deceased ?? ""}`}
              onChange={(e) => {
                const [status, dec] = e.target.value.split(":") as ["ACTIVE" | "LEFT", string];
                setF((x) => ({
                  ...x,
                  status,
                  deceased: (dec || null) as RegisterFilters["deceased"],
                }));
              }}
            >
              <option value="ACTIVE:">Current members</option>
              <option value="ACTIVE:only">Deceased</option>
              <option value="LEFT:include">Former members</option>
            </CFormSelect>
          </div>
          {isParish ? (
            <div className="col-md-2">
              <CFormSwitch
                id="withOut"
                label="Include outstations"
                checked={f.outstations}
                onChange={(e) => set("outstations", e.target.checked)}
              />
            </div>
          ) : null}
        </div>
      </div>

      <div className="card panel">
        {list.isError ? <CAlert color="danger">{errText(list.error)}</CAlert> : null}
        <CTable hover responsive className="cms-table mb-0">
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>Name</CTableHeaderCell>
              <CTableHeaderCell>Contact</CTableHeaderCell>
              <CTableHeaderCell>Role</CTableHeaderCell>
              <CTableHeaderCell>Sacraments</CTableHeaderCell>
              {f.outstations ? <CTableHeaderCell>Church</CTableHeaderCell> : null}
              <CTableHeaderCell>Since</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {list.isPending ? (
              <CTableRow>
                <CTableDataCell colSpan={6}>Loading…</CTableDataCell>
              </CTableRow>
            ) : null}
            {list.data && !list.data.items.length ? (
              <CTableRow>
                <CTableDataCell colSpan={6} className="muted">
                  No one matches.
                </CTableDataCell>
              </CTableRow>
            ) : null}
            {list.data?.items.map((m) => (
              <CTableRow key={m.membershipId}>
                <CTableDataCell>
                  <Link
                    to={`/admin/members/${m.personId}${m.church.id !== ctx.group.id ? `?church=${m.church.id}` : ""}`}
                    className="d-flex align-items-center gap-2"
                  >
                    <Avatar url={m.photoUrl} name={`${m.firstName} ${m.lastName}`} />
                    <span>
                      <b>
                        {m.lastName}, {m.firstName}
                      </b>{" "}
                      {m.otherNames ? <span className="muted">{m.otherNames}</span> : null}
                      {m.isDeceased ? (
                        <CBadge color="dark" className="ms-2">
                          deceased
                        </CBadge>
                      ) : null}
                      {!m.hasAccount ? (
                        <span className="small muted d-block">No app account</span>
                      ) : null}
                    </span>
                  </Link>
                </CTableDataCell>
                <CTableDataCell className="small">
                  {m.telephone ?? ""}
                  <div className="muted">{m.email ?? ""}</div>
                </CTableDataCell>
                <CTableDataCell>
                  {ROLE_LABEL[m.role]}
                  {m.isHome ? <span className="small muted d-block">Home church</span> : null}
                </CTableDataCell>
                <CTableDataCell className="small">
                  <Tick on={m.isBaptised} label="B" title="Baptised" />{" "}
                  <Tick on={m.isCommunicant} label="C" title="First Communion" />{" "}
                  <Tick on={m.isConfirmed} label="Cf" title="Confirmed" />
                </CTableDataCell>
                {f.outstations ? (
                  <CTableDataCell className="small">{m.church.name}</CTableDataCell>
                ) : null}
                <CTableDataCell className="small">{formatDate(m.joinedAt)}</CTableDataCell>
              </CTableRow>
            ))}
          </CTableBody>
        </CTable>
        {list.data && (page > 1 || list.data.hasMore) ? (
          <div className="d-flex justify-content-between mt-3">
            <CButton
              size="sm"
              color="secondary"
              variant="ghost"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </CButton>
            <span className="small muted">Page {page}</span>
            <CButton
              size="sm"
              color="secondary"
              variant="ghost"
              disabled={!list.data.hasMore}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </CButton>
          </div>
        ) : null}
      </div>
    </>
  );
}

function Tick({ on, label, title }: { on: boolean; label: string; title: string }) {
  return (
    <span title={`${title}: ${on ? "yes" : "no"}`} className={`sacr ${on ? "on" : ""}`}>
      {label}
    </span>
  );
}

export function Avatar({
  url,
  name,
  size = 32,
}: {
  url: string | null;
  name: string;
  size?: number;
}) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return url ? (
    <img src={url} alt="" className="reg-photo" style={{ width: size, height: size }} />
  ) : (
    <span
      className="reg-photo reg-photo-blank"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden
    >
      {initials}
    </span>
  );
}

/** Membership requests (functionality §2.5, D-016) — API from Phase 3.5. */
export function RequestsPage() {
  const ctx = useCurrent();
  const q = useRequests(ctx.group.id);
  const decide = useDecide(ctx.group.id);
  const [notes, setNotes] = useState<Record<string, string>>({});
  return (
    <>
      <div className="dash-head">
        <div>
          <h1>Members</h1>
          <p className="dash-sub">
            People asking to join {ctx.group.name}, or to make it their home church.
          </p>
        </div>
      </div>
      <MembersTabs active="requests" />
      {q.isError ? (
        <CAlert
          color={q.error instanceof ApiClientError && q.error.status === 403 ? "info" : "danger"}
        >
          {q.error instanceof ApiClientError && q.error.status === 403
            ? "Only Administrators review membership requests."
            : errText(q.error)}
        </CAlert>
      ) : null}
      {decide.error ? <CAlert color="danger">{errText(decide.error)}</CAlert> : null}
      {q.data && !q.data.items.length ? (
        <section className="card panel muted">No one is waiting.</section>
      ) : null}
      {q.data?.items.map((r) => (
        <section key={r.id} className="card panel mb-3">
          <div className="d-flex flex-wrap gap-3 align-items-center">
            <Avatar url={null} name={`${r.person.firstName} ${r.person.lastName}`} size={40} />
            <div className="flex-grow-1">
              <b>
                {r.person.firstName} {r.person.lastName}
              </b>
              <div className="small muted">
                {[r.person.telephone, r.person.email].filter(Boolean).join(" · ")} · asked{" "}
                {formatDate(r.requestedAt)}
                {r.isHome ? " · as their home church" : ""}
              </div>
            </div>
            <CFormInput
              size="sm"
              style={{ maxWidth: 260 }}
              placeholder="Note (required to decline)"
              value={notes[r.id] ?? ""}
              onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
            />
            <CButton
              size="sm"
              color="primary"
              disabled={decide.isPending}
              onClick={() =>
                decide.mutate({
                  id: r.id,
                  d: { decision: "approve", note: notes[r.id]?.trim() || undefined },
                })
              }
            >
              Approve
            </CButton>
            <CButton
              size="sm"
              color="danger"
              variant="outline"
              disabled={decide.isPending || (notes[r.id] ?? "").trim().length < 3}
              onClick={() =>
                decide.mutate({ id: r.id, d: { decision: "reject", note: notes[r.id]!.trim() } })
              }
            >
              Decline
            </CButton>
          </div>
        </section>
      ))}
      <HomeTransfers groupId={ctx.group.id} churchName={ctx.group.name} />
    </>
  );
}

/**
 * Requests to make this church someone's home (D-016, D-049). Approving moves the person's
 * sacramental records here (edit rights); their previous home is told.
 */
function HomeTransfers({ groupId, churchName }: { groupId: string; churchName: string }) {
  const q = useHomeTransfers(groupId);
  const decide = useDecideTransfer(groupId);
  const [notes, setNotes] = useState<Record<string, string>>({});
  // 403 is already explained above (only Administrators review requests).
  if (q.isError && q.error instanceof ApiClientError && q.error.status === 403) return null;
  return (
    <section className="mt-4" aria-labelledby="transfers-title">
      <h2 id="transfers-title" className="h5 mb-1">
        Home church requests
      </h2>
      <p className="small muted mb-3">
        Members of {churchName} asking to make it their home church. Approving moves their records
        here; their previous home church is told.
      </p>
      {q.isError ? <CAlert color="danger">{errText(q.error)}</CAlert> : null}
      {decide.error ? <CAlert color="danger">{errText(decide.error)}</CAlert> : null}
      {q.data && !q.data.items.length ? (
        <section className="card panel muted">No home church requests.</section>
      ) : null}
      {q.data?.items.map((r) => (
        <section key={r.id} className="card panel mb-3">
          <div className="d-flex flex-wrap gap-3 align-items-center">
            <Avatar url={null} name={`${r.person.firstName} ${r.person.lastName}`} size={40} />
            <div className="flex-grow-1">
              <b>
                {r.person.firstName} {r.person.lastName}
              </b>
              <div className="small muted">
                {r.from ? `Home now: ${r.from.name}` : "No home church at present"} · asked{" "}
                {formatDate(r.requestedAt)}
              </div>
              {r.reason ? <div className="small mt-1">“{r.reason}”</div> : null}
            </div>
            <CFormInput
              size="sm"
              style={{ maxWidth: 260 }}
              placeholder="Note (required to decline)"
              aria-label={`Note for ${r.person.firstName} ${r.person.lastName}`}
              value={notes[r.id] ?? ""}
              onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
            />
            <CButton
              size="sm"
              color="primary"
              disabled={decide.isPending}
              onClick={() =>
                decide.mutate({
                  id: r.id,
                  d: { decision: "approve", note: notes[r.id]?.trim() || undefined },
                })
              }
            >
              Approve
            </CButton>
            <CButton
              size="sm"
              color="danger"
              variant="outline"
              disabled={decide.isPending || (notes[r.id] ?? "").trim().length < 3}
              onClick={() =>
                decide.mutate({ id: r.id, d: { decision: "reject", note: notes[r.id]!.trim() } })
              }
            >
              Decline
            </CButton>
          </div>
        </section>
      ))}
    </section>
  );
}
