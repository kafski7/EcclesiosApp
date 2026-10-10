import type { Comment } from "@ecclesios/shared";
import {
  COMMENT_MAX,
  commentSegments,
  parseLesson,
  youTubeEmbedUrl,
} from "@ecclesios/shared/domain";
import { ArrowLeft, Church, Compass, ExternalLink, MapPin } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { SignInLink } from "@/components/auth/sign-in-link";
import { Lesson } from "@/components/teachings/lesson";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { ApiClientError } from "@/lib/api";
import { authErrorMessage } from "@/lib/auth-errors";
import {
  dateBox,
  eventWhen,
  KIND_LABEL,
  useCommentActions,
  useComments,
  usePost,
} from "@/lib/explore";
import { EngageBar } from "@/components/engage/engage-bar";
import { CommentComposer } from "@/components/explore/comment-composer";
import { useSession } from "@/stores/session";

/** One Explore post with its comments (D-031). */
export function ExplorePostPage() {
  const { id } = useParams();
  const post = usePost(id);
  const blocks = useMemo(() => parseLesson(post.data?.body ?? ""), [post.data?.body]);
  if (post.isPending)
    return (
      <div className="content-narrow mx-auto">
        <Skeleton variant="page" label="Loading the post" />
      </div>
    );
  if (post.isError)
    return (
      <div className="content-narrow mx-auto">
        {post.error instanceof ApiClientError && post.error.status === 404 ? (
          <EmptyState
            icon={Compass}
            title="We couldn't find that post"
            action={
              <Link to="/explore" className="btn btn-outline btn-sm">
                Back to Explore
              </Link>
            }
          />
        ) : (
          <ErrorState
            title="This post could not be loaded"
            error={post.error}
            onRetry={() => post.refetch()}
            retrying={post.isRefetching}
          />
        )}
      </div>
    );
  const p = post.data;

  return (
    <div className="content-narrow mx-auto">
      <Link to="/explore" className="link mb-4">
        <ArrowLeft className="ic" aria-hidden /> Explore
      </Link>
      <article className="card post-page-head">
        <span className={`x-tag${p.kind === "EVENT" ? " x-tag--gold" : ""}`}>
          {KIND_LABEL[p.kind]}
        </span>
        <h1>{p.title}</h1>
        <p className="small muted flex items-center gap-2">
          {p.author.kind === "CHURCH" ? (
            <Link to={`/explore/churches/${p.author.id}`} className="link">
              <Church className="ic" aria-hidden /> {p.author.name}
            </Link>
          ) : (
            p.author.name
          )}
          {p.publishedAt
            ? ` · ${new Date(p.publishedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`
            : ""}
        </p>
        {p.event ? (
          <div className="event-box">
            <span className="date-box" aria-hidden>
              <b>{dateBox(p.event.startsAt).day}</b>
              <small>{dateBox(p.event.startsAt).month}</small>
            </span>
            <div className="meta">
              <b>{eventWhen(p.event.startsAt, p.event.endsAt)}</b>
              <span className="flex items-center gap-1">
                <MapPin className="ic" style={{ width: 14, height: 14 }} aria-hidden />{" "}
                {p.event.place}
              </span>
              {p.event.onlineUrl ? (
                <a
                  href={p.event.onlineUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link"
                >
                  Join online <ExternalLink className="ic" aria-hidden />
                </a>
              ) : null}
            </div>
          </div>
        ) : null}
        {p.coverUrl ? <img src={p.coverUrl} alt="" className="post-cover" /> : null}
        {p.summary ? (
          <p className="mt-4" style={{ fontSize: 16, color: "var(--text-2)" }}>
            {p.summary}
          </p>
        ) : null}
        {p.youtubeId ? (
          <div className="yt-frame mt-4">
            <iframe
              src={youTubeEmbedUrl(p.youtubeId)}
              title={p.title}
              loading="lazy"
              allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : null}
        <div className="mt-4">
          <Lesson blocks={blocks} />
        </div>
        <EngageBar
          kind="POST"
          id={p.id}
          title={p.title}
          href={`/explore/posts/${p.id}`}
          comments={{ count: p.commentCount }}
          size="md"
        />
      </article>
      <Comments postId={p.id} />
    </div>
  );
}

function Comments({ postId }: { postId: string }) {
  const principal = useSession((s) => s.principal);
  const list = useComments(postId);
  const act = useCommentActions(postId);
  const [reported, setReported] = useState<string[]>([]);
  const items = list.data?.items ?? [];

  return (
    <section className="card rail-card mt-4" aria-label="Comments" id="comments">
      <h2 className="rail-title mb-3">
        Comments{items.length ? ` (${items.filter((c) => c.status === "VISIBLE").length})` : ""}
      </h2>
      {principal?.kind === "member" ? (
        <CommentComposer
          postId={postId}
          maxLength={COMMENT_MAX}
          pending={act.add.isPending}
          error={act.add.error ? commentError(act.add.error) : null}
          onSend={(text, done) => act.add.mutate(text, { onSuccess: done })}
        />
      ) : !principal ? (
        <p className="small muted mb-3">
          <SignInLink /> to join the conversation.
        </p>
      ) : null}
      {list.isPending ? <Skeleton variant="rows" count={2} label="Loading comments" /> : null}
      {list.isError ? (
        <ErrorState
          title="Comments could not be loaded"
          error={list.error}
          onRetry={() => list.refetch()}
          retrying={list.isRefetching}
          compact
        />
      ) : null}
      {list.isSuccess && !items.length ? (
        <p className="small muted">No comments yet. Be the first.</p>
      ) : null}
      <ul className="comments">
        {items.map((c) => (
          <CommentRow
            key={c.id}
            c={c}
            reported={reported.includes(c.id)}
            canReport={principal?.kind === "member" && !c.author.isMe}
            onDelete={() => confirm("Delete your comment?") && act.remove.mutate(c.id)}
            onReport={() =>
              act.report.mutate(c.id, { onSuccess: () => setReported((r) => [...r, c.id]) })
            }
            onToggle={() =>
              act.setStatus.mutate({
                id: c.id,
                status: c.status === "VISIBLE" ? "HIDDEN" : "VISIBLE",
              })
            }
          />
        ))}
      </ul>
    </section>
  );
}

function CommentRow(props: {
  c: Comment;
  reported: boolean;
  canReport: boolean;
  onDelete: () => void;
  onReport: () => void;
  onToggle: () => void;
}) {
  const { c } = props;
  return (
    <li id={`c-${c.id}`} style={c.status === "HIDDEN" ? { opacity: 0.6 } : undefined}>
      <span className="avatar av-32 av-slate" aria-hidden>
        {c.author.name
          .split(" ")
          .map((x) => x[0])
          .slice(0, 2)
          .join("")}
      </span>
      <div className="min-w-0 flex-1">
        <b className="small">{c.author.name}</b>{" "}
        <span className="small muted">
          {new Date(c.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
        </span>
        {c.status === "HIDDEN" ? <div className="hidden-note">Hidden</div> : null}
        <p className="small" style={{ whiteSpace: "pre-line", color: "var(--text-2)" }}>
          {commentSegments(c.body, new Map(c.mentions.map((m) => [m.id, m.name]))).map((x, i) =>
            x.t === "mention" ? (
              <span key={i} className="mention">
                @{x.name}
              </span>
            ) : (
              <span key={i}>{x.v}</span>
            ),
          )}
        </p>
        <div className="comment-actions">
          {c.canDelete ? (
            <button type="button" onClick={props.onDelete}>
              Delete
            </button>
          ) : null}
          {c.canModerate ? (
            <button type="button" onClick={props.onToggle}>
              {c.status === "VISIBLE" ? "Hide" : "Show again"}
            </button>
          ) : null}
          {props.canReport ? (
            props.reported ? (
              <span className="muted">Reported — thank you</span>
            ) : (
              <button type="button" onClick={props.onReport}>
                Report
              </button>
            )
          ) : null}
        </div>
      </div>
    </li>
  );
}

/** Server messages for comment errors, incl. links and mentions (D-035). */
function commentError(e: unknown) {
  if (e instanceof ApiClientError) {
    if (e.code === "VALIDATION_FAILED") {
      const msg = (e.details as { fieldErrors?: { body?: string[] } } | undefined)?.fieldErrors
        ?.body?.[0];
      return msg ?? "Please check your comment.";
    }
    if (e.code === "MENTION_NOT_ALLOWED" || e.code === "RATE_LIMITED") return e.message;
  }
  return authErrorMessage(e instanceof ApiClientError ? e : null);
}
