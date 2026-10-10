import { compactCount, type EngageKind } from "@ecclesios/shared/domain";
import { Bookmark, Heart, MessageCircle, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSignInHere } from "@/components/auth/sign-in-link";
import { shareLink, shareNote, useEngage, useEngageToggle } from "@/lib/engage";
import { useSession } from "@/stores/session";

/**
 * Like ♥ · (comments) · Save · Share for posts, teachings, episodes, hymns and books
 * (D-035, docs/social.md §10, D-043). Sits OUTSIDE card links (buttons can't live inside <a>).
 *
 * - Visitors are sent to sign in and brought back to this page afterwards.
 * - Like/Save flip at once (optimistic) and roll back with a visible message if the server says no.
 * - A tap while the previous one is still being sent is ignored (no double toggles).
 * - Status notes are announced politely to screen readers and clear themselves.
 */
export function EngageBar({
  kind,
  id,
  title,
  href,
  comments,
  size = "sm",
}: {
  kind: EngageKind;
  id: string;
  title: string;
  /** Path of the item's page, for Share. */
  href: string;
  /** Explore posts only (D-031). */
  comments?: { count: number; to?: string };
  size?: "sm" | "md";
}) {
  const principal = useSession((s) => s.principal);
  const navigate = useNavigate();
  const signIn = useSignInHere();
  const q = useEngage(kind, id);
  const toggle = useEngageToggle(kind, id);
  const [note, setNote] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isMember = principal?.kind === "member";

  useEffect(() => () => clearTimeout(timer.current), []);
  const flash = (text: string | null, ms = 2500) => {
    clearTimeout(timer.current);
    setNote(text);
    if (text) timer.current = setTimeout(() => setNote(null), ms);
  };

  const needMember = () => {
    if (isMember) return false;
    if (!principal) navigate(signIn);
    else flash("Likes and saves are for member accounts.", 4000);
    return true;
  };
  const send = (type: "like" | "save") => {
    if (needMember() || toggle.isPending) return;
    const on = type === "like" ? !q.data?.liked : !q.data?.saved;
    toggle.mutate(
      { type, on },
      {
        onSuccess: () => type === "save" && flash(on ? "Saved" : "Removed from saved", 1800),
        onError: () =>
          flash(
            `Couldn't ${type === "like" ? (on ? "like" : "unlike") : on ? "save" : "unsave"} — try again`,
            4000,
          ),
      },
    );
  };
  const share = async () => flash(shareNote(await shareLink(title, href)));

  const liked = !!q.data?.liked;
  const saved = !!q.data?.saved;
  const likes = q.data?.likes ?? 0;
  const busy = toggle.isPending;

  return (
    <div
      className={`engage engage-${size}`}
      role="group"
      aria-label={`Reactions to ${title}`}
      aria-busy={busy || undefined}
    >
      <button
        type="button"
        className={`eng-btn${liked ? " on" : ""}`}
        onClick={() => send("like")}
        aria-pressed={liked}
        aria-label={`${liked ? "Unlike" : "Like"}${likes ? ` (${likes} like${likes === 1 ? "" : "s"})` : ""}`}
      >
        <Heart className="ic" fill={liked ? "currentColor" : "none"} aria-hidden />
        <span aria-hidden>{likes ? compactCount(likes) : "Like"}</span>
      </button>
      {comments ? (
        comments.to ? (
          <Link
            className="eng-btn"
            to={comments.to}
            aria-label={
              comments.count
                ? `${comments.count} comment${comments.count === 1 ? "" : "s"}`
                : "Comment"
            }
          >
            <MessageCircle className="ic" aria-hidden />
            <span aria-hidden>{comments.count ? compactCount(comments.count) : "Comment"}</span>
          </Link>
        ) : (
          <span
            className="eng-btn eng-static"
            aria-label={`${comments.count} comment${comments.count === 1 ? "" : "s"}`}
          >
            <MessageCircle className="ic" aria-hidden />
            <span aria-hidden>{compactCount(comments.count)}</span>
          </span>
        )
      ) : null}
      <button
        type="button"
        className={`eng-btn${saved ? " on-save" : ""}`}
        onClick={() => send("save")}
        aria-pressed={saved}
        aria-label={saved ? "Remove from saved" : "Save"}
      >
        <Bookmark className="ic" fill={saved ? "currentColor" : "none"} aria-hidden />
        {size === "md" ? <span aria-hidden>{saved ? "Saved" : "Save"}</span> : null}
      </button>
      <button type="button" className="eng-btn eng-share" onClick={() => void share()} aria-label="Share">
        <Share2 className="ic" aria-hidden />
        {size === "md" ? <span aria-hidden>Share</span> : null}
      </button>
      {/* Always mounted so screen readers hear each change. */}
      <span className="eng-note" role="status" aria-live="polite">
        {note}
      </span>
    </div>
  );
}
