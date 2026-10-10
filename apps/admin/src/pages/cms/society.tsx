import {
  CAlert,
  CBadge,
  CButton,
  CForm,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from "@coreui/react";
import type { RosterEntry, Society } from "@ecclesios/shared";
import type { SocietyKind } from "@ecclesios/shared/domain";
import { ArrowLeft, Download, Printer, UserPlus } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useCurrent } from "@/lib/cms";
import {
  downloadRoster,
  KIND_TEXT,
  rosterFileName,
  SUGGESTED_POSITIONS,
  useAddToRoster,
  useArchive,
  useCandidates,
  useDeleteSociety,
  useRemoveFromRoster,
  useSaveSociety,
  useSetPosition,
  useSociety,
} from "@/lib/societies";
import { errText } from "./societies";

/** One society or committee: details, leader and roster (D-038). */
export function SocietyPage({ kind }: { kind: SocietyKind }) {
  const ctx = useCurrent();
  const { id } = useParams();
  const q = useSociety(ctx.group.id, id);
  const text = KIND_TEXT[kind];
  if (q.isPending) return <p>Loading…</p>;
  if (q.isError)
    return (
      <>
        <Link to={text.path}>← {text.many}</Link>
        <CAlert color="danger" className="mt-3">
          {errText(q.error)}
        </CAlert>
      </>
    );
  return <View s={q.data} kind={kind} />;
}

function View({ s, kind }: { s: Society; kind: SocietyKind }) {
  const ctx = useCurrent();
  const navigate = useNavigate();
  const text = KIND_TEXT[kind];
  const archive = useArchive(ctx.group.id, s.id);
  const del = useDeleteSociety(ctx.group.id);
  const [editing, setEditing] = useState(false);
  const [exportErr, setExportErr] = useState<string | null>(null);
  const showChurch = s.roster.some((r) => r.church.id !== ctx.group.id);
  const err = archive.error ?? del.error;

  return (
    <>
      <p className="mb-2 d-print-none">
        <Link to={text.path}>
          <ArrowLeft className="ic" aria-hidden /> {text.many}
        </Link>
      </p>
      <div className="dash-head">
        <div>
          <h1>
            {s.name} {!s.isActive ? <CBadge color="secondary">Archived</CBadge> : null}
          </h1>
          <p className="dash-sub">
            {ctx.group.name} · {s.leader ? `Led by ${s.leader.name}` : "No leader"} ·{" "}
            {s.rosterCount} {s.rosterCount === 1 ? "person" : "people"}
          </p>
        </div>
        <div className="d-flex flex-wrap gap-2 d-print-none">
          <CButton
            color="secondary"
            variant="outline"
            onClick={() =>
              downloadRoster(ctx.group.id, s.id, rosterFileName(ctx.group.name, s.name)).catch(
                (e) => setExportErr(errText(e)),
              )
            }
          >
            <Download className="ic" aria-hidden /> Export
          </CButton>
          <CButton color="secondary" variant="outline" onClick={() => window.print()}>
            <Printer className="ic" aria-hidden /> Print
          </CButton>
          {s.can.manage ? (
            <>
              <CButton color="primary" variant="outline" onClick={() => setEditing(true)}>
                Edit
              </CButton>
              <CButton
                color="secondary"
                variant="ghost"
                disabled={archive.isPending}
                onClick={() => archive.mutate(s.isActive)}
              >
                {s.isActive ? "Archive" : "Restore"}
              </CButton>
              {!s.isActive && s.rosterCount === 0 ? (
                <CButton
                  color="danger"
                  variant="ghost"
                  onClick={() =>
                    confirm(`Delete ${s.name}?`) &&
                    del.mutate(s.id, { onSuccess: () => navigate(text.path) })
                  }
                >
                  Delete
                </CButton>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
      {err || exportErr ? <CAlert color="danger">{err ? errText(err) : exportErr}</CAlert> : null}
      {!s.isActive ? (
        <CAlert color="secondary">
          Archived: the roster is kept but can't be changed. Restore it to make changes.
        </CAlert>
      ) : null}
      {s.description ? (
        <div className="card panel mb-3" style={{ whiteSpace: "pre-line" }}>
          {s.description}
        </div>
      ) : null}

      {s.can.roster && s.isActive ? <AddPeople s={s} /> : null}

      <div className="card panel">
        <CTable hover responsive className="cms-table mb-0">
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>Name</CTableHeaderCell>
              <CTableHeaderCell>Position</CTableHeaderCell>
              <CTableHeaderCell>Phone</CTableHeaderCell>
              {showChurch ? <CTableHeaderCell>Church</CTableHeaderCell> : null}
              <CTableHeaderCell className="d-print-none" />
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {s.roster.map((r) => (
              <RosterRow key={r.personId} s={s} r={r} showChurch={showChurch} />
            ))}
            {!s.roster.length ? (
              <CTableRow>
                <CTableDataCell colSpan={5} className="text-body-secondary">
                  No one on the roster yet.
                </CTableDataCell>
              </CTableRow>
            ) : null}
          </CTableBody>
        </CTable>
      </div>
      <datalist id="positions">
        {SUGGESTED_POSITIONS.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
      {editing ? <EditModal s={s} kind={kind} onClose={() => setEditing(false)} /> : null}
    </>
  );
}

function RosterRow({ s, r, showChurch }: { s: Society; r: RosterEntry; showChurch: boolean }) {
  const ctx = useCurrent();
  const setPos = useSetPosition(ctx.group.id, s.id);
  const remove = useRemoveFromRoster(ctx.group.id, s.id);
  const [pos, setPosText] = useState(r.position ?? "");
  useEffect(() => setPosText(r.position ?? ""), [r.position]);
  const editable = s.can.roster && s.isActive;
  const save = () => {
    if ((pos.trim() || null) !== r.position)
      setPos.mutate({ personId: r.personId, position: pos.trim() || null });
  };

  return (
    <CTableRow>
      <CTableDataCell>
        <b>{r.name}</b>{" "}
        {r.isLeader ? (
          <CBadge color="primary" className="ms-1">
            Leader
          </CBadge>
        ) : null}
        {s.can.manage ? (
          <div className="small d-print-none">
            <Link to={`/admin/members/${r.personId}`}>Profile</Link>
          </div>
        ) : null}
      </CTableDataCell>
      <CTableDataCell style={{ minWidth: 180 }}>
        {editable ? (
          <CFormInput
            size="sm"
            list="positions"
            placeholder="Member"
            aria-label={`Position of ${r.name}`}
            value={pos}
            maxLength={60}
            onChange={(e) => setPosText(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
            invalid={!!setPos.error}
          />
        ) : (
          (r.position ?? "—")
        )}
      </CTableDataCell>
      <CTableDataCell>{r.telephone ?? "—"}</CTableDataCell>
      {showChurch ? <CTableDataCell>{r.church.name}</CTableDataCell> : null}
      <CTableDataCell className="text-end d-print-none">
        {editable && !r.isLeader ? (
          <CButton
            size="sm"
            color="danger"
            variant="ghost"
            disabled={remove.isPending}
            onClick={() => confirm(`Take ${r.name} off the roster?`) && remove.mutate(r.personId)}
          >
            Remove
          </CButton>
        ) : null}
        {remove.error ? <div className="small text-danger">{errText(remove.error)}</div> : null}
      </CTableDataCell>
    </CTableRow>
  );
}

function AddPeople({ s }: { s: Society }) {
  const ctx = useCurrent();
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);
  const cand = useCandidates(ctx.group.id, s.id, term, term.length > 0);
  const add = useAddToRoster(ctx.group.id, s.id);

  return (
    <div className="card panel mb-3 d-print-none">
      <CFormLabel htmlFor="addp">
        <UserPlus className="ic" aria-hidden /> Add people
      </CFormLabel>
      <CFormInput
        id="addp"
        placeholder={
          ctx.group.level === "PARISH"
            ? "Search members of this parish and its outstations"
            : "Search members of this church"
        }
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {add.error ? (
        <CAlert color="danger" className="mt-2 mb-0">
          {errText(add.error)}
        </CAlert>
      ) : null}
      {term ? (
        <ul className="list-unstyled mt-2 mb-0">
          {cand.data?.items.map((c) => (
            <li key={c.personId} className="d-flex align-items-center gap-2 py-1">
              <span className="flex-grow-1">
                <b>{c.name}</b>{" "}
                <span className="small text-body-secondary">
                  · {c.church}
                  {c.telephone ? ` · ${c.telephone}` : ""}
                </span>
              </span>
              <CButton
                size="sm"
                color="primary"
                variant="outline"
                disabled={add.isPending}
                onClick={() =>
                  add.mutate(
                    { personId: c.personId, position: null },
                    { onSuccess: () => setQ("") },
                  )
                }
              >
                Add
              </CButton>
            </li>
          ))}
          {cand.data && !cand.data.items.length ? (
            <li className="small text-body-secondary">
              No one found who isn't already on the roster.
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}

function EditModal({ s, kind, onClose }: { s: Society; kind: SocietyKind; onClose: () => void }) {
  const ctx = useCurrent();
  const save = useSaveSociety(ctx.group.id, s.id);
  const [name, setName] = useState(s.name);
  const [description, setDescription] = useState(s.description ?? "");
  const [leader, setLeader] = useState(s.leader?.id ?? "");
  // A leader must be an active member of this church itself (not an outstation), and on the roster.
  const eligible = s.roster.filter((r) => r.church.id === ctx.group.id);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(
      { name, description: description.trim() || null, leaderPersonId: leader || null },
      { onSuccess: onClose },
    );
  };

  return (
    <CModal visible onClose={onClose} alignment="center">
      <CForm onSubmit={submit}>
        <CModalHeader>
          <CModalTitle>Edit {KIND_TEXT[kind].one}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {save.error ? <CAlert color="danger">{errText(save.error)}</CAlert> : null}
          <CFormLabel htmlFor="en">Name</CFormLabel>
          <CFormInput
            id="en"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={200}
            className="mb-3"
          />
          <CFormLabel htmlFor="ed">Description</CFormLabel>
          <CFormTextarea
            id="ed"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mb-3"
          />
          <CFormLabel htmlFor="el">Leader</CFormLabel>
          <CFormSelect id="el" value={leader} onChange={(e) => setLeader(e.target.value)}>
            <option value="">No leader</option>
            {eligible.map((r) => (
              <option key={r.personId} value={r.personId}>
                {r.name}
              </option>
            ))}
          </CFormSelect>
          <p className="small text-body-secondary mt-2 mb-0">
            Choose from people on the roster who belong to {ctx.group.name}. Add someone to the
            roster first to make them leader.
          </p>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="ghost" onClick={onClose}>
            Cancel
          </CButton>
          <CButton
            type="submit"
            color="primary"
            disabled={save.isPending || name.trim().length < 2}
          >
            {save.isPending ? "Saving…" : "Save"}
          </CButton>
        </CModalFooter>
      </CForm>
    </CModal>
  );
}
