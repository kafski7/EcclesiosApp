import { CAlert, CBadge, CButton, CForm, CFormCheck, CFormInput, CFormLabel, CFormText, CFormTextarea } from "@coreui/react";
import type { AdminTeaching } from "@ecclesios/shared";
import { lintLesson, parseLesson, readingMinutes } from "@ecclesios/shared/domain";
import { Preview } from "@/components/lesson-preview";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiClientError } from "@/lib/api";
import { SNIPPETS, useAdminTeaching, useAdminTopics, useDeleteTeaching, useSaveTeaching, useTeachingStatus } from "@/lib/teachings";

const errText = (e: unknown) => (e instanceof ApiClientError ? e.message : e instanceof Error ? e.message : "Something went wrong.");

/** Write / edit a teaching with a live preview and a problems list (D-030). */
export function TeachingEditPage() {
  const { slug } = useParams();
  const isNew = !slug || slug === "new";
  const q = useAdminTeaching(isNew ? undefined : slug);
  if (!isNew && q.isPending) return <p className="muted">Loading…</p>;
  if (!isNew && q.isError) return <CAlert color="danger">{errText(q.error)}</CAlert>;
  return (
    <>
      <Link to="/platform/teachings" className="link mb-3 d-inline-block">← All teachings</Link>
      <Editor key={q.data?.slug ?? "new"} teaching={isNew ? null : q.data!} />
    </>
  );
}

function Editor({ teaching }: { teaching: AdminTeaching | null }) {
  const navigate = useNavigate();
  const topics = useAdminTopics();
  const save = useSaveTeaching(teaching?.slug);
  const status = useTeachingStatus(teaching?.slug ?? "");
  const del = useDeleteTeaching();
  const [title, setTitle] = useState(teaching?.title ?? "");
  const [summary, setSummary] = useState(teaching?.summary ?? "");
  const [body, setBody] = useState(teaching?.body ?? "");
  const [chosen, setChosen] = useState<string[]>(teaching?.topics.map((t) => t.slug) ?? []);
  const [related, setRelated] = useState(teaching?.relatedSlugs.join(", ") ?? "");
  const [reviewedBy, setReviewedBy] = useState(teaching?.reviewedBy ?? "");
  const [source, setSource] = useState(teaching?.source ?? "");
  const area = useRef<HTMLTextAreaElement>(null);
  const blocks = useMemo(() => parseLesson(body), [body]);
  // Live check of the text; links to other teachings are checked by the server on save.
  const localProblems = useMemo(() => lintLesson(body), [body]);
  const live = teaching?.status === "PUBLISHED";
  const saved = save.data ?? teaching;

  useEffect(() => {
    if (save.data && !teaching) navigate(`/platform/teachings/${save.data.slug}`, { replace: true });
  }, [save.data, teaching, navigate]);

  const insert = (snippet: string) => {
    const el = area.current;
    if (!el) return setBody((b) => b + snippet);
    const { selectionStart: a, selectionEnd: b } = el;
    setBody((v) => v.slice(0, a) + snippet + v.slice(b));
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = a + snippet.length;
    });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate({
      title,
      summary,
      body,
      topics: chosen,
      related: related.split(",").map((s) => s.trim()).filter(Boolean),
      reviewedBy: reviewedBy.trim() || null,
      source: source.trim() || null,
    });
  };

  return (
    <div className="row g-4">
      <div className="col-lg-6">
        <section className="card panel">
          <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{teaching ? "Edit teaching" : "New teaching"}</h1>
            {teaching ? live ? <CBadge color="success">Published</CBadge> : <CBadge color="secondary">Draft</CBadge> : null}
            {teaching ? (
              <span className="ms-auto d-flex gap-2">
                <CButton
                  size="sm"
                  color={live ? "secondary" : "primary"}
                  variant={live ? "outline" : undefined}
                  disabled={status.isPending || (!live && (saved?.problems.length ?? 0) > 0)}
                  title={!live && saved?.problems.length ? "Fix the problems first" : undefined}
                  onClick={() => status.mutate(live ? "DRAFT" : "PUBLISHED")}
                >
                  {live ? "Unpublish" : "Publish"}
                </CButton>
                <CButton
                  size="sm"
                  color="danger"
                  variant="ghost"
                  onClick={() => confirm(`Delete "${teaching.title}"?`) && del.mutate(teaching.slug, { onSuccess: () => navigate("/platform/teachings") })}
                >
                  Delete
                </CButton>
              </span>
            ) : null}
          </div>
          {save.error ? <CAlert color="danger">{errText(save.error)}</CAlert> : null}
          {status.error ? <CAlert color="danger">{errText(status.error)}</CAlert> : null}
          {save.isSuccess && teaching ? <CAlert color="success">Saved.</CAlert> : null}
          <CForm onSubmit={submit}>
            <div className="mb-3">
              <CFormLabel htmlFor="tt">Title</CFormLabel>
              <CFormInput id="tt" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="mb-3">
              <CFormLabel htmlFor="ts">Summary</CFormLabel>
              <CFormInput id="ts" value={summary} maxLength={300} onChange={(e) => setSummary(e.target.value)} required />
            </div>
            <div className="mb-3">
              <CFormLabel>Topics</CFormLabel>
              <div className="d-flex flex-wrap gap-3">
                {topics.data?.items.map((t) => (
                  <CFormCheck
                    key={t.slug}
                    id={`topic-${t.slug}`}
                    label={t.name}
                    checked={chosen.includes(t.slug)}
                    onChange={(e) => setChosen((c) => (e.target.checked ? [...c, t.slug] : c.filter((x) => x !== t.slug)))}
                  />
                ))}
              </div>
            </div>
            <div className="mb-2">
              <CFormLabel htmlFor="tb">Lesson</CFormLabel>
              <div className="d-flex flex-wrap gap-1 mb-1">
                {(
                  [
                    ["Heading", SNIPPETS.heading],
                    ["Quote", SNIPPETS.quote],
                    ["List", SNIPPETS.list],
                    ["Bible ref", SNIPPETS.bible],
                    ["Catechism", SNIPPETS.ccc],
                    ["Link teaching", SNIPPETS.teaching],
                  ] as const
                ).map(([label, snip]) => (
                  <CButton key={label} size="sm" color="secondary" variant="outline" onClick={() => insert(snip)}>
                    {label}
                  </CButton>
                ))}
              </div>
              <CFormTextarea id="tb" ref={area} rows={18} value={body} onChange={(e) => setBody(e.target.value)} style={{ fontFamily: "ui-monospace, monospace", fontSize: 13.5 }} />
              <CFormText>
                Blank line between paragraphs. **bold**, *italic*, ## heading, &gt; quote, - list. References: [[Luke 22:19]], [[CCC 1324]],
                [[teaching:slug|label]]. About {readingMinutes(blocks)} min.
              </CFormText>
            </div>
            <div className="mb-3">
              <CFormLabel htmlFor="tr">Related teachings (slugs, comma-separated)</CFormLabel>
              <CFormInput id="tr" value={related} onChange={(e) => setRelated(e.target.value)} placeholder="baptism, the-eucharist" />
              <CFormText>Teachings linked in the lesson are added automatically.</CFormText>
            </div>
            <div className="row g-2 mb-3">
              <div className="col-md-6">
                <CFormLabel htmlFor="rv">Reviewed by</CFormLabel>
                <CFormInput id="rv" value={reviewedBy} onChange={(e) => setReviewedBy(e.target.value)} placeholder="Rev. Fr. …" />
              </div>
              <div className="col-md-6">
                <CFormLabel htmlFor="sc">Source</CFormLabel>
                <CFormInput id="sc" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Ecclesios" />
              </div>
            </div>
            <CButton type="submit" color="primary" disabled={save.isPending || !chosen.length}>
              {save.isPending ? "Saving…" : teaching ? "Save" : "Create draft"}
            </CButton>
          </CForm>
        </section>
      </div>

      <div className="col-lg-6">
        {[...new Set([...localProblems, ...(saved?.problems ?? [])])].length ? (
          <CAlert color="warning">
            <b>Fix before publishing</b>
            <ul className="mb-0">
              {[...new Set([...localProblems, ...(saved?.problems ?? [])])].map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </CAlert>
        ) : null}
        <section className="card panel">
          <p className="small muted mb-2">Preview</p>
          <h2 style={{ fontSize: 22, fontWeight: 700 }}>{title || "Title"}</h2>
          <p className="muted">{summary}</p>
          <Preview blocks={blocks} />
        </section>
      </div>
    </div>
  );
}
