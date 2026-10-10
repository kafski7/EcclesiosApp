import {
  CAlert,
  CBadge,
  CFormInput,
  CFormSelect,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from "@coreui/react";
import type { MemberRole } from "@ecclesios/shared/domain";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useStaff } from "@/lib/account";
import { ApiClientError } from "@/lib/api";
import { formatDate, useCurrent } from "@/lib/cms";
import { EMPTY_FILTERS, ROLE_LABEL, useChangeRole, useRegister } from "@/lib/register";

const errText = (e: unknown) => (e instanceof ApiClientError ? e.message : "Something went wrong.");
const ROLES: MemberRole[] = ["ADMINISTRATOR", "MANAGER", "SOCIETY_LEADER", "PARISHIONER"];

/** Users & Roles (functionality §4.8, D-039): who manages this church. Roles are per membership (D-014). */
export function UsersPage() {
  const ctx = useCurrent();
  const staff = useStaff(ctx.group.id);

  return (
    <>
      <div className="dash-head">
        <div>
          <h1>Users &amp; Roles</h1>
          <p className="dash-sub">
            Who can open Church Management for {ctx.group.name}, and with which role.
          </p>
        </div>
      </div>
      {staff.isError ? <CAlert color="danger">{errText(staff.error)}</CAlert> : null}
      <div className="card panel mb-3">
        <CTable hover responsive className="cms-table mb-0">
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>Name</CTableHeaderCell>
              <CTableHeaderCell>Role</CTableHeaderCell>
              <CTableHeaderCell>Leads</CTableHeaderCell>
              <CTableHeaderCell>Last sign-in</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {staff.data?.items.map((s) => (
              <CTableRow key={s.personId}>
                <CTableDataCell>
                  <Link to={`/admin/members/${s.personId}`}>
                    <b>{s.name}</b>
                  </Link>{" "}
                  {s.isYou ? <CBadge color="secondary">You</CBadge> : null}
                  <div className="small text-body-secondary">{s.telephone ?? s.email ?? ""}</div>
                </CTableDataCell>
                <CTableDataCell style={{ minWidth: 190 }}>
                  {staff.data.canManage && !s.isYou ? (
                    <RoleSelect personId={s.personId} role={s.role} />
                  ) : (
                    ROLE_LABEL[s.role]
                  )}
                </CTableDataCell>
                <CTableDataCell className="small">{s.leads.join(", ") || "—"}</CTableDataCell>
                <CTableDataCell className="small">
                  {s.hasAccount
                    ? s.lastLoginAt
                      ? formatDate(s.lastLoginAt)
                      : "Never"
                    : "No app account yet"}
                </CTableDataCell>
              </CTableRow>
            ))}
          </CTableBody>
        </CTable>
      </div>
      {staff.data?.canManage ? (
        <GiveRole />
      ) : (
        <p className="small text-body-secondary">Only Administrators change roles.</p>
      )}
      <p className="small text-body-secondary">
        Administrators run everything here, including Settings and Billing. Managers keep the
        register, societies and messages. Society-Leaders keep the rosters of what they lead. Nobody
        can change their own role, and a church always keeps at least one Administrator.
      </p>
    </>
  );
}

function RoleSelect({ personId, role }: { personId: string; role: MemberRole }) {
  const ctx = useCurrent();
  const qc = useQueryClient();
  const change = useChangeRole(ctx.group.id, personId);
  return (
    <>
      <CFormSelect
        size="sm"
        aria-label="Role"
        value={role}
        disabled={change.isPending}
        onChange={(e) =>
          change.mutate(e.target.value as MemberRole, {
            onSuccess: () =>
              void qc.invalidateQueries({ queryKey: ["church", ctx.group.id, "staff"] }),
          })
        }
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABEL[r]}
          </option>
        ))}
      </CFormSelect>
      {change.error ? <div className="small text-danger">{errText(change.error)}</div> : null}
    </>
  );
}

/** Give a member of this church a CMS role. */
function GiveRole() {
  const ctx = useCurrent();
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);
  const people = useRegister(ctx.group.id, { ...EMPTY_FILTERS, q: term, role: "PARISHIONER" }, 1);
  return (
    <div className="card panel mb-3">
      <b className="mb-2 d-block">Give someone a role</b>
      <CFormInput
        placeholder="Search parishioners of this church"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {term ? (
        <ul className="list-unstyled mt-2 mb-0">
          {people.data?.items
            .filter((p) => p.church.id === ctx.group.id)
            .map((p) => (
              <li key={p.personId} className="d-flex align-items-center gap-2 py-1">
                <span className="flex-grow-1">
                  <b>
                    {p.firstName} {p.lastName}
                  </b>{" "}
                  <span className="small text-body-secondary">
                    {p.hasAccount ? "" : "· no app account yet"}
                  </span>
                </span>
                <span style={{ width: 200 }}>
                  <RoleSelect personId={p.personId} role="PARISHIONER" />
                </span>
              </li>
            ))}
          {people.data && !people.data.items.length ? (
            <li className="small text-body-secondary">No parishioners found.</li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
