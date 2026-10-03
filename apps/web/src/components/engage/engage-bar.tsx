import { compactCount, type EngageKind } from "@ecclesios/shared/domain";
import { Bookmark, Heart, MessageCircle, Share2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { shareLink, useEngage, useEngageToggle } from "@/lib/engage";
import { useSession } from "@/stores/session";

/**
 * Like ♥ · (comments) · Save · Share for posts, teachings, episodes and hymns (D-035).
 * Sits OUTSIDE card links (buttons can't live inside <a>). Guests are sent to sign in.
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
  const q = useEngage(kind, id);
  const toggle = useEngageToggle(kind, id);
  const [note, setNote] = useState<string | null>(null);
  const isMember = principal?.kind === "member";

  const needMember = () => {
    if (isMember) return false;
    if (!principal) navigate("/login");
    else setNote("Likes and saves are for member accounts.");
    return true;
  };
  const like = () => !needMember() && toggle.mutate({ type: "like", on: !q.data?.liked });
  const save = () => !needMember() && toggle.mutate({ type: "save", on: !q.data?.saved });
  const share = async () => {
    const r = await shareLink(title, href);
    setNote(r === "copied" ? "Link copied" : r === "failed" ? "Couldn't share" : null);
    if (r !== "shared") setTimeout(() => setNote(null), 2000);
  };
  const likes = q.data?.likes ?? 0;

  return (
    <div className={`engage engage-${size}`} role="group" aria-label="Reactions">
      <button type="button" className={`eng-btn${q.data?.liked ? " on" : ""}`} onClick={like} aria-pressed={!!q.data?.liked} aria-label={q.data?.liked ? "Unlike" : "Like"}>
        <Heart className="ic" fill={q.data?.liked ? "currentColor" : "none"} aria-hidden />
        <span>{likes ? compactCount(likes) : "Like"}</span>
      </button>
      {comments ? (
        comments.to ? (
          <a className="eng-btn" href={comments.to} onClick={(e) => (e.preventDefault(), navigate(comments.to!))} aria-label="Comments">
            <MessageCircle className="ic" aria-hidden />
            <span>{comments.count ? compactCount(comments.count) : "Comment"}</span>
          </a>
        ) : (
          <span className="eng-btn eng-static" aria-label={`${comments.count} comments`}>
            <MessageCircle className="ic" aria-hidden />
            <span>{compactCount(comments.count)}</span>
          </span>
        )
      ) : null}
      <button type="button" className={`eng-btn${q.data?.saved ? " on-save" : ""}`} onClick={save} aria-pressed={!!q.data?.saved} aria-label={q.data?.saved ? "Remove from saved" : "Save"}>
        <Bookmark className="ic" fill={q.data?.saved ? "currentColor" : "none"} aria-hidden />
        {size === "md" ? <span>{q.data?.saved ? "Saved" : "Save"}</span> : null}
      </button>
      <button type="button" className="eng-btn" onClick={() => void share()} aria-label="Share">
        <Share2 className="ic" aria-hidden />
        {size === "md" ? <span>Share</span> : null}
      </button>
      {note ? (
        <span className="eng-note" role="status">
          {note}
        </span>
      ) : null}
    </div>
  );
}
