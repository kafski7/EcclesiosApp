import { CAlert, CBadge, CButton, CForm, CFormCheck, CFormInput, CFormLabel, CFormSelect, CFormText, CFormTextarea } from "@coreui/react";
import type { AdminNews, NewsCategory } from "@ecclesios/shared";
import { lintLesson, parseLesson } from "@ecclesios/shared/domain";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Preview } from "@/components/lesson-preview";
import { ApiClientError } from "@/lib/api";
import { fromLocalInput, STATE_COLOR, STATE_LABEL, toLocalInput, useAdminNews, useDeleteNews, useNewsStatus, useSaveNews } from "@/lib/news";

const errText = (e: unknown) => (e instanceof ApiClientError ? e.message : e instanceof Error ? e.message : "Something went wrong.");

/** Write / edit a news item (D-032). */
export function NewsEditPage() {
  const { slug } = useParams();
  const isNew = !slug || slug === "new";
  const q = useAdminNews(isNew ? undefined : slug);
  if (!isNew && q.isPending) return <p className="muted">Loading…</p>;
  if (!isNew && q.isError) return <CAlert color="danger">{errText(q.error)}</CAlert>;
  return (
    <>
      <Link to="/platform/news" className="link mb-3 d-inline-block">← All news</Link>
      <Editor key={q.data?.slug ?? "new"} item={isNew ? null : q.data!} />
    </>
  );
}

function Editor({ item }: { item: AdminNews | null }) {
  const navigate = useNavigate();
  const save = useSaveNews(item?.slug);
  const status = useNewsStatus(item?.slug ?? "");
  const del = useDeleteNews();
  const cur = status.data ?? save.data ?? item;
  const [title, setTitle] = useState(item?.title ?? "");
  const [summary, setSummary] = useState(item?.summary ?? "");
  const [body, setBody] = useState(item?.body ?? "");
  const [category, setCategory] = useState<NewsCategory>(item?.category ?? "ANNOUNCEMENT");
  const [pinned, setPinned] = useState(item?.pinned ?? false);
  const [linkUrl, setLinkUrl] = useState(item?.link?.url ?? "");
  const [linkLabel, setLinkLabel] = useState(item?.link?.label ?? "");
  const [expires, setExpires] = useState(toLocalInput(item?.expiresAt ?? null));
  const [publishAt, setPublishAt] = useState("");
  const blocks = useMemo(() => parseLesson(body), [body]);
  const problems = useMemo(() => (body.trim() ? lintLesson(body) : []), [body]);
  const live = cur?.status === "PUBLISHED";

  useEffect(() => {
    if (save.data && !item) navigate(`/platform/news/${save.data.slug}`, { replace: true });
  }, [save.data, item, navigate]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate({
      title,
      summary,
      body,
      category,
      pinned,
      linkUrl: linkUrl.trim() || null,
      linkLabel: linkLabel.trim() || null,
      expiresAt: fromLocalInput(expires),
      publishAt: null,
    });
  };

  return (
    <div className="row g-4">
      <div className="col-lg-6">
        <section className="card panel">
          <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{item ? "Edit news" : "New news item"}</h1>
            {cur ? <CBadge color={STATE_COLOR[cur.state]}>{STATE_LABEL[cur.state]}</CBadge> : null}
            {cur?.state === "SCHEDULED" && cur.publishedAt ? <span className="small muted">goes live {new Date(cur.publishedAt).toLocaleString()}</span> : null}
          </div>
          {[save.error, status.error, del.error].filter(Boolean).map((e, i) => (
            <CAlert key={i} color="danger">{errText(e)}</CAlert>
          ))}
          {save.isSuccess && item ? <CAlert color="success">Saved.</CAlert> : null}
          <CForm onSubmit={submit}>
            <div className="mb-3">
              <CFormLabel htmlFor="nt">Title</CFormLabel>
              <CFormInput id="nt" value={title} maxLength={140} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="mb-3">
              <CFormLabel htmlFor="ns">Summary (shown on Home)</CFormLabel>
              <CFormInput id="ns" value={summary} maxLength={280} onChange={(e) => setSummary(e.target.value)} required />
            </div>
            <div className="row g-2 mb-3">
              <div className="col-md-6">
                <CFormLabel htmlFor="nc">Category</CFormLabel>
                <CFormSelect id="nc" value={category} onChange={(e) => setCategory(e.target.value as NewsCategory)}>
                  <option value="ANNOUNCEMENT">Announcement</option>
                  <option value="UPDATE">App update</option>
                  <option value="NOTICE">Notice</option>
                </CFormSelect>
              </div>
              <div className="col-md-6 d-flex align-items-end">
                <CFormCheck id="np" label="Pin to the top" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
              </div>
            </div>
            <div className="mb-3">
              <CFormLabel htmlFor="nb">Text (optional)</CFormLabel>
              <CFormTextarea id="nb" rows={10} value={body} onChange={(e) => setBody(e.target.value)} style={{ fontFamily: "ui-monospace, monospace", fontSize: 13.5 }} />
              <CFormText>Same format as Teachings: **bold**, ## heading, &gt; quote, - list, [[John 3:16]], [[CCC 1324]].</CFormText>
            </div>
            <div className="row g-2 mb-3">
              <div className="col-md-7">
                <CFormLabel htmlFor="nl">Button link (optional)</CFormLabel>
                <CFormInput id="nl" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" />
              </div>
              <div className="col-md-5">
                <CFormLabel htmlFor="nll">Button text</CFormLabel>
                <CFormInput id="nll" value={linkLabel} maxLength={40} onChange={(e) => setLinkLabel(e.target.value)} placeholder="Learn more" />
              </div>
            </div>
            <div className="mb-3">
              <CFormLabel htmlFor="ne">Leaves Home after (optional)</CFormLabel>
              <CFormInput id="ne" type="datetime-local" value={expires} onChange={(e) => setExpires(e.target.value)} />
              <CFormText>The news page keeps it afterwards.</CFormText>
            </div>
            <CButton type="submit" color="primary" disabled={save.isPending}>
              {save.isPending ? "Saving…" : item ? "Save" : "Create draft"}
            </CButton>
          </CForm>
        </section>

        {item ? (
          <section className="card panel mt-4">
            <h2 className="panel-title mb-2">Publishing</h2>
            {live ? (
              <CButton color="secondary" variant="outline" disabled={status.isPending} onClick={() => status.mutate({ status: "DRAFT", publishAt: null })}>
                Back to draft
              </CButton>
            ) : (
              <div className="d-flex gap-2 flex-wrap align-items-end">
                <CButton color="primary" disabled={status.isPending || problems.length > 0} onClick={() => status.mutate({ status: "PUBLISHED", publishAt: null })}>
                  Publish now
                </CButton>
                <div>
                  <CFormLabel htmlFor="npa" className="small mb-1">or schedule</CFormLabel>
                  <CFormInput id="npa" type="datetime-local" value={publishAt} onChange={(e) => setPublishAt(e.target.value)} />
                </div>
                <CButton color="primary" variant="outline" disabled={!publishAt || status.isPending || problems.length > 0} onClick={() => status.mutate({ status: "PUBLISHED", publishAt: fromLocalInput(publishAt) })}>
                  Schedule
                </CButton>
              </div>
            )}
            <hr />
            <CButton color="danger" variant="ghost" onClick={() => confirm(`Delete "${item.title}"?`) && del.mutate(item.slug, { onSuccess: () => navigate("/platform/news") })}>
              Delete
            </CButton>
          </section>
        ) : null}
      </div>
      <div className="col-lg-6">
        {problems.length ? (
          <CAlert color="warning">
            <b>Fix before publishing</b>
            <ul className="mb-0">
              {problems.map((p) => (
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
