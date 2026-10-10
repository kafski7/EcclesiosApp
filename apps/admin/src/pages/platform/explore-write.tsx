import {
  CAlert,
  CBadge,
  CButton,
  CForm,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
} from "@coreui/react";
import type { MyPost, PostKind } from "@ecclesios/shared";
import { parseLesson } from "@ecclesios/shared/domain";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Preview } from "@/components/lesson-preview";
import { ApiClientError } from "@/lib/api";
import { STATUS_COLOR, useAuthoring, useMyPost, useMyPosts, useWrite } from "@/lib/explore";

const errText = (e: unknown) => (e instanceof ApiClientError ? e.message : "Something went wrong.");
const local = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const iso = (v: string) => (v ? new Date(v).toISOString() : null);

/** Platform accounts' own Explore posts (Super-Admins publish directly; creators go through review). */
export function ExploreMinePage() {
  const mine = useMyPosts();
  const authoring = useAuthoring();
  return (
    <>
      <div className="dash-head">
        <div>
          <h1>My Explore posts</h1>
          <p className="dash-sub">Posts under your own name.</p>
        </div>
        {authoring.data?.asSelf ? (
          <Link to="/platform/explore/write/new" className="btn btn-primary btn-sm">
            New post
          </Link>
        ) : null}
      </div>
      {authoring.data && !authoring.data.asSelf ? (
        <CAlert color="info">Your account doesn't have the Explore authoring grant yet.</CAlert>
      ) : null}
      <section className="card panel">
        {mine.isPending ? <p className="muted">Loading…</p> : null}
        {mine.data && !mine.data.items.length ? <p className="muted mb-0">Nothing yet.</p> : null}
        {mine.data?.items.map((p) => (
          <Link
            key={p.id}
            to={`/platform/explore/write/${p.id}`}
            className="d-flex gap-3 align-items-center py-2 border-bottom text-reset"
          >
            <div className="flex-grow-1">
              <b>{p.title}</b>
              <div className="small muted">
                {p.kind === "EVENT" ? "Event" : "Article"} · edited{" "}
                {new Date(p.updatedAt).toLocaleDateString()}
              </div>
              {p.reviewNote && p.status !== "APPROVED" ? (
                <div className="small text-danger">Reviewer: {p.reviewNote}</div>
              ) : null}
            </div>
            <CBadge color={STATUS_COLOR[p.status]}>{p.status}</CBadge>
          </Link>
        ))}
      </section>
    </>
  );
}

export function ExploreWritePage() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const q = useMyPost(isNew ? undefined : id);
  if (!isNew && q.isPending) return <p className="muted">Loading…</p>;
  if (!isNew && q.isError) return <CAlert color="danger">{errText(q.error)}</CAlert>;
  return <Editor key={q.data?.id ?? "new"} post={isNew ? null : q.data!} />;
}

function Editor({ post }: { post: MyPost | null }) {
  const navigate = useNavigate();
  const w = useWrite();
  const [kind, setKind] = useState<PostKind>(post?.kind ?? "ARTICLE");
  const [title, setTitle] = useState(post?.title ?? "");
  const [summary, setSummary] = useState(post?.summary ?? "");
  const [body, setBody] = useState(post?.body ?? "");
  const [youtube, setYoutube] = useState(post?.youtube ?? "");
  const [startsAt, setStartsAt] = useState(local(post?.event?.startsAt));
  const [endsAt, setEndsAt] = useState(local(post?.event?.endsAt));
  const [place, setPlace] = useState(post?.event?.place ?? "");
  const blocks = useMemo(() => parseLesson(body), [body]);
  const err = w.save.error ?? w.submit.error ?? w.remove.error;
  const locked = post?.status === "REMOVED";
  const payload = () => ({
    kind,
    churchId: null,
    title,
    summary,
    body,
    youtube: youtube.trim() || null,
    startsAt: kind === "EVENT" ? iso(startsAt) : null,
    endsAt: kind === "EVENT" ? iso(endsAt) : null,
    place: kind === "EVENT" ? place.trim() || null : null,
  });
  const save = (submit: boolean) =>
    w.save.mutate(
      { id: post?.id, body: payload() },
      {
        onSuccess: (p) =>
          submit
            ? w.submit.mutate(p.id, { onSuccess: () => navigate("/platform/explore/mine") })
            : !post && navigate(`/platform/explore/write/${p.id}`, { replace: true }),
      },
    );
  return (
    <>
      <Link to="/platform/explore/mine" className="link mb-3 d-inline-block">
        ← My posts
      </Link>
      <div className="d-flex gap-2 align-items-center mb-3">
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
          {post ? "Edit post" : "New post"}
        </h1>
        {post ? <CBadge color={STATUS_COLOR[post.status]}>{post.status}</CBadge> : null}
      </div>
      <div className="dash-grid">
        <section className="card panel">
          <CForm onSubmit={(e) => e.preventDefault()}>
            <div className="mb-3">
              <CFormLabel htmlFor="k">Type</CFormLabel>
              <CFormSelect
                id="k"
                value={kind}
                onChange={(e) => setKind(e.target.value as PostKind)}
                disabled={locked}
              >
                <option value="ARTICLE">Article</option>
                <option value="EVENT">Event</option>
              </CFormSelect>
            </div>
            <div className="mb-3">
              <CFormLabel htmlFor="t">Title</CFormLabel>
              <CFormInput
                id="t"
                value={title}
                maxLength={160}
                onChange={(e) => setTitle(e.target.value)}
                disabled={locked}
              />
            </div>
            <div className="mb-3">
              <CFormLabel htmlFor="s">Summary</CFormLabel>
              <CFormInput
                id="s"
                value={summary}
                maxLength={280}
                onChange={(e) => setSummary(e.target.value)}
                disabled={locked}
              />
            </div>
            {kind === "EVENT" ? (
              <div className="d-flex gap-2 mb-3 flex-wrap">
                <div className="flex-grow-1">
                  <CFormLabel htmlFor="st">Starts</CFormLabel>
                  <CFormInput
                    id="st"
                    type="datetime-local"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                  />
                </div>
                <div className="flex-grow-1">
                  <CFormLabel htmlFor="en">Ends</CFormLabel>
                  <CFormInput
                    id="en"
                    type="datetime-local"
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                  />
                </div>
                <div className="w-100">
                  <CFormLabel htmlFor="pl">Place</CFormLabel>
                  <CFormInput id="pl" value={place} onChange={(e) => setPlace(e.target.value)} />
                </div>
              </div>
            ) : null}
            <div className="mb-3">
              <CFormLabel htmlFor="b">Text</CFormLabel>
              <CFormTextarea
                id="b"
                rows={14}
                style={{ fontFamily: "ui-monospace, monospace", fontSize: 13 }}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                disabled={locked}
              />
            </div>
            <div className="mb-3">
              <CFormLabel htmlFor="y">YouTube (optional)</CFormLabel>
              <CFormInput
                id="y"
                value={youtube}
                onChange={(e) => setYoutube(e.target.value)}
                disabled={locked}
              />
            </div>
            {post?.problems.length ? (
              <CAlert color="warning">{post.problems.join(" ")}</CAlert>
            ) : null}
            {err ? <CAlert color="danger">{errText(err)}</CAlert> : null}
            {!locked ? (
              <div className="d-flex gap-2">
                <CButton
                  color="secondary"
                  variant="outline"
                  disabled={w.save.isPending || title.trim().length < 3}
                  onClick={() => save(false)}
                >
                  Save draft
                </CButton>
                <CButton
                  color="primary"
                  disabled={w.save.isPending || w.submit.isPending || title.trim().length < 3}
                  onClick={() => save(true)}
                >
                  Submit
                </CButton>
                {post ? (
                  <CButton
                    color="danger"
                    variant="ghost"
                    onClick={() =>
                      confirm("Delete this post?") &&
                      w.remove.mutate(post.id, {
                        onSuccess: () => navigate("/platform/explore/mine"),
                      })
                    }
                  >
                    Delete
                  </CButton>
                ) : null}
              </div>
            ) : null}
          </CForm>
        </section>
        <section className="card panel">
          <p className="small muted mb-2">Preview</p>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>{title || "Untitled"}</h2>
          <Preview blocks={blocks} />
        </section>
      </div>
    </>
  );
}
