import type { CmsContext } from "@ecclesios/shared";
import { Link } from "react-router-dom";
import { PlanCards } from "@/components/plans";
import { formatDate } from "@/lib/cms";

/** Shown instead of CMS pages when the church's subscription is closed (functionality §6, D-020). */
export function NotSubscribedPage({ context }: { context: CmsContext }) {
  const s = context.subscription!;
  const holderAdmin = context.role === "ADMINISTRATOR" && context.group.level === "PARISH";
  return (
    <section className="card empty">
      {s.state === "NONE" ? (
        <>
          <h2>{s.holder.name} hasn't subscribed yet</h2>
          <p>
            Church Management opens once the parish subscribes. The social platform stays open to
            everyone.
            {s.canStartTrial
              ? " Start a free trial on any plan below — no payment needed."
              : " Ask your parish Administrator to start a subscription."}
          </p>
          {s.canStartTrial ? <PlanCards trialFor={s.holder.id} /> : null}
        </>
      ) : (
        <>
          <h2>{s.holder.name}'s subscription has ended</h2>
          <p>
            The {s.plan?.name ?? ""} plan ended on {formatDate(s.expiresAt)}. Your records are safe
            and will be here when it is renewed.{" "}
            {holderAdmin
              ? "To renew, contact the Ecclesios team with your payment reference — they will reactivate it straight away."
              : "Ask your parish Administrator to renew it."}
          </p>
          {holderAdmin ? (
            <Link to="/admin/billing" className="btn btn-primary btn-sm">
              Open billing
            </Link>
          ) : null}
        </>
      )}
    </section>
  );
}
