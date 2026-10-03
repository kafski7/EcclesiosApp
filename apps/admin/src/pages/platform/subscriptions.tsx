import {
  CAlert,
  CButton,
  CForm,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormText,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from "@coreui/react";
import type { PlanCode, PlatformSubscriptionRow } from "@ecclesios/shared";
import { useState } from "react";
import { StateBadge } from "@/components/brand";
import { ApiClientError } from "@/lib/api";
import { authErrorMessage, fieldErrors } from "@/lib/auth-errors";
import { formatDate, useGrantSubscription, usePlans, usePlatformSubscriptions } from "@/lib/cms";

/** Church subscription list + manual activation / renewal (todo Phase 4, D-021). */
export function PlatformSubscriptionsPage() {
  const list = usePlatformSubscriptions();
  const [editing, setEditing] = useState<PlatformSubscriptionRow | null>(null);
  return (
    <>
      <div className="dash-head">
        <div>
          <h1>Subscriptions</h1>
          <p className="dash-sub">
            Parishes hold the subscription; their outstations are covered by it.
          </p>
        </div>
      </div>
      {list.isError ? <CAlert color="danger">The list could not be loaded.</CAlert> : null}
      <section className="card panel">
        <CTable hover responsive className="cms-table mb-0">
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>Parish</CTableHeaderCell>
              <CTableHeaderCell>Diocese</CTableHeaderCell>
              <CTableHeaderCell>Outstations</CTableHeaderCell>
              <CTableHeaderCell>Status</CTableHeaderCell>
              <CTableHeaderCell>Plan</CTableHeaderCell>
              <CTableHeaderCell>Expires</CTableHeaderCell>
              <CTableHeaderCell>SMS</CTableHeaderCell>
              <CTableHeaderCell />
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {list.isPending ? (
              <CTableRow>
                <CTableDataCell colSpan={8} className="muted">
                  Loading…
                </CTableDataCell>
              </CTableRow>
            ) : null}
            {list.data?.items.map((r) => (
              <CTableRow key={r.parish.id}>
                <CTableDataCell>
                  <b>{r.parish.name}</b>
                  {r.parish.code ? <div className="small muted">{r.parish.code}</div> : null}
                </CTableDataCell>
                <CTableDataCell>{r.diocese ?? "—"}</CTableDataCell>
                <CTableDataCell>{r.outstations}</CTableDataCell>
                <CTableDataCell>
                  <StateBadge state={r.state} />
                </CTableDataCell>
                <CTableDataCell>{r.plan?.name ?? "—"}</CTableDataCell>
                <CTableDataCell>
                  {formatDate(r.expiresAt)}
                  {r.daysLeft !== null && r.daysLeft >= 0 && r.state !== "EXPIRED" ? (
                    <div className="small muted">{r.daysLeft} days left</div>
                  ) : null}
                </CTableDataCell>
                <CTableDataCell>{r.smsBalance.toLocaleString()}</CTableDataCell>
                <CTableDataCell className="text-end">
                  <CButton
                    size="sm"
                    color="primary"
                    variant="outline"
                    onClick={() => setEditing(r)}
                  >
                    {r.state === "ACTIVE" ? "Renew / change" : "Activate"}
                  </CButton>
                </CTableDataCell>
              </CTableRow>
            ))}
          </CTableBody>
        </CTable>
      </section>
      {editing ? <GrantModal row={editing} onClose={() => setEditing(null)} /> : null}
    </>
  );
}

function GrantModal({ row, onClose }: { row: PlatformSubscriptionRow; onClose: () => void }) {
  const plans = usePlans();
  const grant = useGrantSubscription();
  const [planCode, setPlanCode] = useState<PlanCode>(row.plan?.code ?? "BASIC");
  const [days, setDays] = useState("");
  const [reference, setReference] = useState("");
  const plan = plans.data?.items.find((p) => p.code === planCode);
  const err = grant.error instanceof ApiClientError ? grant.error : null;
  const fe = err?.code === "VALIDATION_FAILED" ? fieldErrors(err.details) : {};

  return (
    <CModal visible onClose={onClose} alignment="center" aria-labelledby="grant-title">
      <CForm
        onSubmit={(e) => {
          e.preventDefault();
          grant.mutate(
            { parishId: row.parish.id, planCode, days: days ? Number(days) : undefined, reference },
            { onSuccess: onClose },
          );
        }}
      >
        <CModalHeader>
          <CModalTitle id="grant-title">
            {row.state === "ACTIVE" ? "Renew or change plan" : "Activate subscription"}
          </CModalTitle>
        </CModalHeader>
        <CModalBody>
          <p className="small muted">
            {row.parish.name}
            {row.state === "ACTIVE" ? " — unused days and SMS credit carry over." : ""}
          </p>
          {err && err.code !== "VALIDATION_FAILED" ? (
            <CAlert color="danger">{authErrorMessage(err)}</CAlert>
          ) : null}
          <div className="mb-3">
            <CFormLabel htmlFor="plan">Plan</CFormLabel>
            <CFormSelect
              id="plan"
              value={planCode}
              onChange={(e) => setPlanCode(e.target.value as PlanCode)}
            >
              {plans.data?.items.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
            </CFormSelect>
          </div>
          <div className="mb-3">
            <CFormLabel htmlFor="days">Period (days)</CFormLabel>
            <CFormInput
              id="days"
              type="number"
              min={1}
              max={1098}
              placeholder={plan ? String(plan.durationDays) : ""}
              value={days}
              onChange={(e) => setDays(e.target.value)}
              invalid={!!fe.days}
            />
            <CFormText>{fe.days ?? "Leave empty for the plan's standard period."}</CFormText>
          </div>
          <div className="mb-1">
            <CFormLabel htmlFor="ref">Payment reference</CFormLabel>
            <CFormInput
              id="ref"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. mobile-money transaction id"
              invalid={!!fe.reference}
            />
            <CFormText>{fe.reference ?? "Recorded in the audit log."}</CFormText>
          </div>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="ghost" onClick={onClose}>
            Cancel
          </CButton>
          <CButton
            color="primary"
            type="submit"
            disabled={grant.isPending || reference.trim().length < 3}
          >
            {grant.isPending ? "Saving…" : "Save"}
          </CButton>
        </CModalFooter>
      </CForm>
    </CModal>
  );
}
