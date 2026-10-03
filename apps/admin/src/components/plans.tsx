import { CAlert, CButton } from "@coreui/react";
import type { Plan, PlanCode } from "@ecclesios/shared";
import { Check } from "lucide-react";
import { ApiClientError } from "@/lib/api";
import { authErrorMessage } from "@/lib/auth-errors";
import { formatMoney, usePlans, useStartTrial } from "@/lib/cms";

const FEATURE_LABEL: Record<string, string> = {
  members: "Member records",
  societies: "Societies & committees",
  birthdays: "Birthdays",
  notifications: "Notifications",
  messages: "SMS & email messages",
  outstations: "Outstations",
  "accounting-link": "Accounting link",
  reports: "Reports",
  "priority-support": "Priority support",
};

/** Plan cards (functionality §4.11). With `trialFor`, each card offers the one-time free trial. */
export function PlanCards({ current, trialFor }: { current?: PlanCode | null; trialFor?: string }) {
  const plans = usePlans();
  if (plans.isPending) return <p className="muted small">Loading plans…</p>;
  if (plans.isError) return <CAlert color="danger">Plans could not be loaded.</CAlert>;
  return (
    <div className="plans">
      {plans.data.items.map((p) => (
        <PlanCard key={p.code} plan={p} current={p.code === current} trialFor={trialFor} />
      ))}
    </div>
  );
}

function PlanCard({
  plan,
  current,
  trialFor,
}: {
  plan: Plan;
  current: boolean;
  trialFor?: string;
}) {
  return (
    <div className={`card plan${current ? " current" : ""}`}>
      <h3>{plan.name}</h3>
      <div className="price">
        {formatMoney(plan.price, plan.currencyCode)}
        {Number(plan.price) > 0 ? (
          <small className="muted small"> / {Math.round(plan.durationDays / 30.4)} months</small>
        ) : null}
      </div>
      <ul>
        <li>
          {plan.maxMembers
            ? `Up to ${plan.maxMembers.toLocaleString()} members`
            : "Unlimited members"}
        </li>
        <li>{plan.smsIncluded.toLocaleString()} SMS included</li>
        {plan.features.map((f) => (
          <li key={f}>
            <Check
              className="ic"
              style={{ width: 14, height: 14, display: "inline", marginRight: 6 }}
              aria-hidden
            />
            {FEATURE_LABEL[f] ?? f}
          </li>
        ))}
      </ul>
      {current ? <span className="chip chip-gold">Current plan</span> : null}
      {trialFor ? <TrialButton parishId={trialFor} plan={plan} /> : null}
    </div>
  );
}

function TrialButton({ parishId, plan }: { parishId: string; plan: Plan }) {
  const m = useStartTrial(parishId);
  return (
    <>
      {m.error ? (
        <CAlert color="danger" className="small">
          {authErrorMessage(m.error instanceof ApiClientError ? m.error : null)}
        </CAlert>
      ) : null}
      <CButton color="primary" size="sm" disabled={m.isPending} onClick={() => m.mutate(plan.code)}>
        {m.isPending ? "Starting…" : `Start ${plan.trialDays}-day free trial`}
      </CButton>
    </>
  );
}
