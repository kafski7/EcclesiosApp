import { StateBadge } from "@/components/brand";
import { PlanCards } from "@/components/plans";
import { formatDate, useCurrent } from "@/lib/cms";

/**
 * Billing (functionality §4.11): plan, expiry, SMS balance, plans. Online payment is not built yet (D-021):
 * renewals and upgrades are activated by the Ecclesios team against a payment reference.
 */
export function BillingPage() {
  const ctx = useCurrent();
  const s = ctx.subscription;
  if (!s) return <p className="muted">Monitoring offices don't hold a subscription.</p>;
  return (
    <>
      <div className="dash-head">
        <div>
          <h1>Billing</h1>
          <p className="dash-sub">
            Your Ecclesios subscription — this covers {s.holder.name} and its outstations.
          </p>
        </div>
      </div>
      <section className="card panel mb-4">
        <div className="d-flex flex-wrap gap-4 align-items-center">
          <div>
            <div className="small muted">Status</div>
            <StateBadge state={s.state} />
          </div>
          <div>
            <div className="small muted">Plan</div>
            <b>{s.plan?.name ?? "—"}</b>
          </div>
          <div>
            <div className="small muted">{s.state === "EXPIRED" ? "Ended" : "Renews"}</div>
            <b>{formatDate(s.expiresAt)}</b>
          </div>
          <div>
            <div className="small muted">SMS credits</div>
            <b>{s.smsBalance.toLocaleString()}</b>
          </div>
        </div>
        {!s.canStartTrial ? (
          <p className="small muted mt-3 mb-0">
            To renew, upgrade or top up SMS, contact the Ecclesios team with your payment reference.
            Online payment is coming soon.
          </p>
        ) : null}
      </section>
      <h2 className="panel-title mb-3">Plans</h2>
      <PlanCards
        current={s.plan?.code ?? null}
        trialFor={s.canStartTrial ? s.holder.id : undefined}
      />
    </>
  );
}
