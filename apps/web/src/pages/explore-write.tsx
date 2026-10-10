import type { MyPost, PostKind } from "@ecclesios/shared";
import { parseLesson } from "@ecclesios/shared/domain";
import { ArrowLeft, PenLine } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { Lesson } from "@/components/teachings/lesson";
import { ApiClientError } from "@/lib/api";
import {
  canWrite,
  fromLocalInput,
  STATUS_LABEL,
  toLocalInput,
  useAuthoring,
  useMyPost,
  useMyPosts,
  useWriteActions,
} from "@/lib/explore";
import { useSignInHere } from "@/components/auth/sign-in-link";
import { useSession } from "@/stores/session";

const errText = (e: unknown) =>
  e instanceof ApiClientError
    ? e.message
    : e instanceof Error
      ? e.message
      : "Something went wrong.";

/** "My posts" for creators and church Administrators (D-017, D-031). */
export function ExploreMinePage() {
  const principal = useSession((s) => s.principal);
  const signIn = useSignInHere();
  const authoring = useAuthoring();
  const mine = useMyPosts();
  if (!principal) return <Navigate to={signIn} replace />;
  if (authoring.isSuccess && !canWrite(authoring.data) && !mine.data?.items.length)
    return (
      <div className="content-narrow mx-auto card rail-card">
        <h1 className="page-title">Writing on Explore</h1>
        <p className="page-sub mt-2">
          To keep Explore orderly and reverent, posting is by invitation: church Administrators post
          in their church's name, and approved content creators post under their own. Ask Ecclesios
          if you'd like to become a content creator.
        </p>
      </div>
    );
  return (
    <div className="content-narrow mx-auto">
      <header className="page-head flex items-end justify-between gap-3">
        <div>
          <h1 className="page-title">My posts</h1>
          <p className="page-sub">Drafts, posts waiting for review, and what's live.</p>
        </div>
        <Link to="/explore/write/new" className="btn btn-primary btn-sm">
          <PenLine className="ic" aria-hidden /> New post
        </Link>
      </header>
      {mine.isPending ? <p className="muted small">Loading…</p> : null}
      {mine.data && !mine.data.items.length ? (
        <p className="card rail-card muted">Nothing yet.</p>
      ) : null}
      <ul className="flex flex-col gap-3">
        {mine.data?.items.map((p) => (
          <li key={p.id}>
            <Link to={`/explore/write/${p.id}`} className="card rail-card flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <b>{p.title}</b>
                <div className="small muted">
                  {p.author.name} · {p.kind === "EVENT" ? "Event" : "Article"} · edited{" "}
                  {new Date(p.updatedAt).toLocaleDateString()}
                </div>
                {p.reviewNote && (p.status === "REJECTED" || p.status === "REMOVED") ? (
                  <div className="small mt-1" style={{ color: "var(--danger)" }}>
                    Reviewer: {p.reviewNote}
                  </div>
                ) : null}
              </div>
              <span className={`status-chip status-${p.status}`}>{STATUS_LABEL[p.status]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Write or edit a post with a live preview. */
export function ExploreWritePage() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const q = useMyPost(isNew ? undefined : id);
  const authoring = useAuthoring();
  if (!isNew && q.isPending) return <p className="muted small">Loading…</p>;
  if (!isNew && q.isError) return <p className="card rail-card">{errText(q.error)}</p>;
  if (authoring.isPending) return <p className="muted small">Loading…</p>;
  return (
    <Editor key={q.data?.id ?? "new"} post={isNew ? null : q.data!} options={authoring.data!} />
  );
}

function Editor({
  post,
  options,
}: {
  post: MyPost | null;
  options: { asSelf: boolean; churches: { id: string; name: string }[] };
}) {
  const navigate = useNavigate();
  const act = useWriteActions();
  const [kind, setKind] = useState<PostKind>(post?.kind ?? "ARTICLE");
  const [churchId, setChurchId] = useState<string | null>(
    post ? post.churchId : options.asSelf ? null : (options.churches[0]?.id ?? null),
  );
  const [title, setTitle] = useState(post?.title ?? "");
  const [summary, setSummary] = useState(post?.summary ?? "");
  const [body, setBody] = useState(post?.body ?? "");
  const [youtube, setYoutube] = useState(post?.youtube ?? "");
  const [startsAt, setStartsAt] = useState(toLocalInput(post?.event?.startsAt ?? null));
  const [endsAt, setEndsAt] = useState(toLocalInput(post?.event?.endsAt ?? null));
  const [place, setPlace] = useState(post?.event?.place ?? "");
  const [onlineUrl, setOnlineUrl] = useState(post?.event?.onlineUrl ?? "");
  const blocks = useMemo(() => parseLesson(body), [body]);
  const locked = post?.status === "REMOVED";
  const live = post?.status === "APPROVED" || post?.status === "PENDING";
  const err = act.save.error ?? act.submit.error ?? act.remove.error ?? act.cover.error;

  const payload = () => ({
    kind,
    churchId,
    title,
    summary,
    body,
    youtube: youtube.trim() || null,
    startsAt: kind === "EVENT" ? fromLocalInput(startsAt) : null,
    endsAt: kind === "EVENT" ? fromLocalInput(endsAt) : null,
    place: kind === "EVENT" ? place.trim() || null : null,
    onlineUrl: kind === "EVENT" ? onlineUrl.trim() || null : null,
  });
  const save = (thenSubmit: boolean) =>
    act.save.mutate(
      { id: post?.id, body: payload() },
      {
        onSuccess: (saved) => {
          if (thenSubmit)
            act.submit.mutate(saved.id, { onSuccess: () => navigate("/explore/mine") });
          else if (!post) navigate(`/explore/write/${saved.id}`, { replace: true });
        },
      },
    );

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <Link to="/explore/mine" className="link mb-4">
        <ArrowLeft className="ic" aria-hidden /> My posts
      </Link>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h1 className="page-title">{post ? "Edit post" : "New post"}</h1>
        {post ? (
          <span className={`status-chip status-${post.status}`}>{STATUS_LABEL[post.status]}</span>
        ) : null}
      </div>
      {post?.reviewNote && post.status !== "APPROVED" ? (
        <p className="card rail-card mb-4" style={{ borderColor: "var(--danger)" }}>
          Reviewer's note: {post.reviewNote}
        </p>
      ) : null}
      {live ? (
        <p className="small muted mb-3">
          Saving changes takes this post off Explore until it is reviewed again.
        </p>
      ) : null}
      {locked ? (
        <p className="card rail-card mb-4">This post was taken down and can no longer be edited.</p>
      ) : null}

      <div className="write-grid">
        <section className="card rail-card flex flex-col gap-3">
          <div className="flex gap-3 flex-wrap">
            <label className="flex-1">
              <span className="field-label">Type</span>
              <select
                className="field-input"
                value={kind}
                onChange={(e) => setKind(e.target.value as PostKind)}
                disabled={locked}
              >
                <option value="ARTICLE">Article</option>
                <option value="EVENT">Event</option>
              </select>
            </label>
            <label className="flex-1">
              <span className="field-label">Post as</span>
              <select
                className="field-input"
                value={churchId ?? ""}
                onChange={(e) => setChurchId(e.target.value || null)}
                disabled={!!post}
                title={post ? "The author can't be changed after the post is created" : undefined}
              >
                {options.asSelf || (post && !post.churchId) ? (
                  <option value="">Myself</option>
                ) : null}
                {options.churches.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            <span className="field-label">Title</span>
            <input
              className="field-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={160}
              disabled={locked}
            />
          </label>
          <label>
            <span className="field-label">Summary (shown on the card)</span>
            <input
              className="field-input"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              maxLength={280}
              disabled={locked}
            />
          </label>
          {kind === "EVENT" ? (
            <>
              <div className="flex gap-3 flex-wrap">
                <label className="flex-1">
                  <span className="field-label">Starts</span>
                  <input
                    className="field-input"
                    type="datetime-local"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    disabled={locked}
                  />
                </label>
                <label className="flex-1">
                  <span className="field-label">Ends (optional)</span>
                  <input
                    className="field-input"
                    type="datetime-local"
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                    disabled={locked}
                  />
                </label>
              </div>
              <label>
                <span className="field-label">Place</span>
                <input
                  className="field-input"
                  value={place}
                  onChange={(e) => setPlace(e.target.value)}
                  maxLength={200}
                  disabled={locked}
                />
              </label>
              <label>
                <span className="field-label">Online link (optional)</span>
                <input
                  className="field-input"
                  type="url"
                  placeholder="https://"
                  value={onlineUrl}
                  onChange={(e) => setOnlineUrl(e.target.value)}
                  disabled={locked}
                />
              </label>
            </>
          ) : null}
          <label>
            <span className="field-label">Text</span>
            <textarea
              className="field-input"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={locked}
            />
            <span className="small muted">
              ## Heading · **bold** · *italic* · "- " list · "&gt; " quote · [[John 3:16]] · [[CCC
              1213]]
            </span>
          </label>
          <label>
            <span className="field-label">YouTube video (optional)</span>
            <input
              className="field-input"
              placeholder="https://youtu.be/…"
              value={youtube}
              onChange={(e) => setYoutube(e.target.value)}
              disabled={locked}
            />
          </label>
          {post ? (
            <label>
              <span className="field-label">Cover image (JPEG, PNG or WebP, max 5 MB)</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={locked || act.cover.isPending}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) act.cover.mutate({ id: post.id, file: f });
                }}
              />
              {act.cover.isPending ? <span className="small muted"> Uploading…</span> : null}
            </label>
          ) : (
            <p className="small muted">Save the draft first to add a cover image.</p>
          )}

          {post?.problems.length ? (
            <ul className="small" style={{ color: "var(--accent-600)" }}>
              {post.problems.map((p) => (
                <li key={p}>• {p}</li>
              ))}
            </ul>
          ) : null}
          {err ? (
            <p className="small" style={{ color: "var(--danger)" }}>
              {errText(err)}
            </p>
          ) : null}
          {!locked ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={act.save.isPending || title.trim().length < 3}
                onClick={() => save(false)}
              >
                Save draft
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={act.save.isPending || act.submit.isPending || title.trim().length < 3}
                onClick={() => save(true)}
              >
                Submit for review
              </button>
              {post ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() =>
                    confirm("Delete this post?") &&
                    act.remove.mutate(post.id, { onSuccess: () => navigate("/explore/mine") })
                  }
                >
                  Delete
                </button>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="card post-page-head" aria-label="Preview">
          <span className="saint-kicker">Preview</span>
          <h1>{title || "Untitled"}</h1>
          {summary ? <p style={{ color: "var(--text-2)" }}>{summary}</p> : null}
          {post?.coverUrl ? <img src={post.coverUrl} alt="" className="post-cover" /> : null}
          <div className="mt-3">
            <Lesson blocks={blocks} />
          </div>
        </section>
      </div>
    </div>
  );
}
