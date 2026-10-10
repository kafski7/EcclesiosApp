import {
  CAlert,
  CBadge,
  CButton,
  CForm,
  CFormInput,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from "@coreui/react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiClientError } from "@/lib/api";
import { useAddTopic, useAdminTeachings, useAdminTopics, useRemoveTopic } from "@/lib/teachings";

/** Super-Admin: teachings and topics (D-030). */
export function PlatformTeachingsPage() {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 250);
    return () => clearTimeout(t);
  }, [q]);
  const list = useAdminTeachings(debounced);
  const navigate = useNavigate();

  return (
    <>
      <div className="dash-head">
        <div>
          <h1>Teachings</h1>
          <p className="dash-sub">
            Official catechesis. Drafts are visible only here until published.
          </p>
        </div>
        <CButton color="primary" onClick={() => navigate("/platform/teachings/new")}>
          New teaching
        </CButton>
      </div>
      <div className="card panel mb-4">
        <CFormInput
          placeholder="Search by title or summary"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="mb-3"
        />
        <CTable hover responsive className="cms-table">
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>Teaching</CTableHeaderCell>
              <CTableHeaderCell>Topics</CTableHeaderCell>
              <CTableHeaderCell>Length</CTableHeaderCell>
              <CTableHeaderCell>Status</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {list.isPending ? (
              <CTableRow>
                <CTableDataCell colSpan={4}>Loading…</CTableDataCell>
              </CTableRow>
            ) : null}
            {list.data?.items.map((t) => (
              <CTableRow key={t.slug}>
                <CTableDataCell>
                  <Link to={`/platform/teachings/${t.slug}`}>
                    <b>{t.title}</b>
                  </Link>
                </CTableDataCell>
                <CTableDataCell>{t.topics.map((x) => x.name).join(", ")}</CTableDataCell>
                <CTableDataCell>{t.readingMinutes} min</CTableDataCell>
                <CTableDataCell>
                  {t.status === "PUBLISHED" ? (
                    <CBadge color="success">Published</CBadge>
                  ) : (
                    <CBadge color="secondary">Draft</CBadge>
                  )}
                </CTableDataCell>
              </CTableRow>
            ))}
          </CTableBody>
        </CTable>
      </div>
      <Topics />
    </>
  );
}

function Topics() {
  const topics = useAdminTopics();
  const add = useAddTopic();
  const remove = useRemoveTopic();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const err = add.error ?? remove.error;
  return (
    <div className="card panel">
      <div className="panel-head">
        <h2 className="panel-title">Topics</h2>
      </div>
      <ul className="mb-3">
        {topics.data?.items.map((t) => (
          <li key={t.slug} className="d-flex align-items-center gap-2 py-1">
            <b>{t.name}</b>
            <span className="small muted">
              {t.teachingCount} published · {t.description}
            </span>
            {t.teachingCount === 0 ? (
              <CButton
                size="sm"
                color="danger"
                variant="ghost"
                className="ms-auto"
                onClick={() => confirm(`Delete the topic ${t.name}?`) && remove.mutate(t.slug)}
              >
                Delete
              </CButton>
            ) : null}
          </li>
        ))}
      </ul>
      <CForm
        className="d-flex gap-2 flex-wrap"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim())
            add.mutate(
              { name: name.trim(), description: description.trim() },
              {
                onSuccess: () => {
                  setName("");
                  setDescription("");
                },
              },
            );
        }}
      >
        <CFormInput
          style={{ maxWidth: 220 }}
          placeholder="New topic"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <CFormInput
          style={{ flex: 1, minWidth: 220 }}
          placeholder="Short description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <CButton type="submit" color="primary" variant="outline" disabled={add.isPending}>
          Add topic
        </CButton>
      </CForm>
      {err ? (
        <CAlert color="danger" className="mt-2">
          {err instanceof ApiClientError ? err.message : "Something went wrong."}
        </CAlert>
      ) : null}
    </div>
  );
}
