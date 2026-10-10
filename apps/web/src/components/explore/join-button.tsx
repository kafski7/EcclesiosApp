import { Check, Clock, Home, UserPlus } from "lucide-react";
import { Link } from "react-router-dom";
import { SignInLink } from "@/components/auth/sign-in-link";
import { useMe } from "@/lib/me";
import { standingWith, useMembershipActions } from "@/lib/memberships";
import { errorText } from "@/lib/states";
import { useSession } from "@/stores/session";

/**
 * Join a church from its page (D-015, D-049). The API has allowed this since D-015, but until
 * now the only way to join was at sign-up. Joining also follows; the church office approves.
 */
export function JoinButton({ churchId, churchName }: { churchId: string; churchName: string }) {
  const principal = useSession((s) => s.principal);
  const me = useMe();
  const { join } = useMembershipActions();

  if (!principal)
    return <SignInLink className="btn btn-primary btn-sm">Sign in to join</SignInLink>;
  if (principal.kind !== "member") return null;

  const standing = standingWith(me.data, churchId);
  if (standing === "home" || standing === "member")
    return (
      <Link to="/me#churches" className="btn btn-outline btn-sm" title="Manage your churches">
        {standing === "home" ? <Home className="ic" aria-hidden /> : <Check className="ic" aria-hidden />}
        {standing === "home" ? "Home church" : "Member"}
      </Link>
    );
  if (standing === "pending")
    return (
      <Link to="/me#churches" className="btn btn-outline btn-sm" title="Waiting for the church office">
        <Clock className="ic" aria-hidden /> Request sent
      </Link>
    );

  return (
    <span className="join-wrap">
      <button
        type="button"
        className="btn btn-primary btn-sm"
        disabled={join.isPending || me.isPending}
        onClick={() => join.mutate(churchId)}
        aria-describedby={join.error ? `join-err-${churchId}` : undefined}
      >
        <UserPlus className="ic" aria-hidden /> {join.isPending ? "Sending…" : "Join"}
      </button>
      {join.error ? (
        <span id={`join-err-${churchId}`} className="small join-error" role="alert">
          {errorText(join.error, `Couldn't ask to join ${churchName}.`)}
        </span>
      ) : null}
    </span>
  );
}
