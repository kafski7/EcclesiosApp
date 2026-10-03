import { Clock } from "lucide-react";
import { useMe } from "@/lib/me";

/**
 * Shown while a membership request is waiting (D-015): the person already has the full
 * social platform; only that church's members-only features wait for approval.
 */
export function MembershipBanner() {
  const me = useMe();
  const pending = me.data?.memberships.filter((m) => m.status === "PENDING") ?? [];
  if (!pending.length) return null;
  const names = pending.map((m) => m.church.name).join(", ");
  return (
    <div
      className="card"
      role="status"
      style={{
        display: "flex",
        gap: 12,
        alignItems: "center",
        padding: "12px 16px",
        marginBottom: 18,
      }}
    >
      <Clock className="ic" style={{ color: "var(--accent-600)" }} aria-hidden />
      <p className="small" style={{ margin: 0 }}>
        Waiting for <b>{names}</b> to confirm your membership. Everything else on Ecclesios is open
        to you now; members-only notices, societies and dues for{" "}
        {pending.length === 1 ? "that church" : "those churches"} unlock once confirmed.
      </p>
    </div>
  );
}
