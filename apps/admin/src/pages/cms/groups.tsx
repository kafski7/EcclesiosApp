import {
  CAlert,
  CBadge,
  CButton,
  CForm,
  CFormInput,
  CFormLabel,
  CFormText,
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
import type { GroupChild } from "@ecclesios/shared";
import { LEVEL_NAME, suggestCode, type HierarchyLevel } from "@ecclesios/shared/domain";
import { ArrowLeft, EyeOff, Plus } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiClientError } from "@/lib/api";
import { useCreateGroup, useGroups, useGroupStatus, useUpdateGroup } from "@/lib/church";
import { LEVEL_LABEL, useCurrent, useDashboard } from "@/lib/cms";
import { EMPTY_FILTERS, useRegister } from "@/lib/register";

const errText = (e: unknown) => (e instanceof ApiClientError ? e.message : "Something went wrong.");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The groups under the current church (functionality §4.13, D-041). */
export function GroupsPage() {
  const ctx = useCurrent();
  return <GroupView groupId={ctx.group.id} />;
}

/** A group further down: its figures and the groups under it (read-only unless you run it). */
export function GroupDetailPage() {
  const { id } = useParams();
  const ctx = useCurrent();
  const dash = useDashboard(id!);
  return (
    <>
      <p className="mb-2">
        <Link to="/admin/groups">
          <ArrowLeft className="ic" aria-hidden /> Groups of {ctx.group.name}
        </Link>
      </p>
      {dash.data ? (
        <div className="stats-grid mb-3">
          <Figure label="Members" value={dash.data.members} />
          <Figure label="Waiting to join" value={dash.data.pendingRequests} />
          <Figure label="Societies" value={dash.data.societies} />
          {dash.data.rollup ? (
            <Figure label="Members, all levels below" value={dash.data.rollup.members} />
          ) : null}
        </div>
      ) : dash.isError ? (
        <CAlert color="secondary">{errText(dash.error)}</CAlert>
      ) : null}
      <GroupView groupId={id!} nested />
    </>
  );
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div className="card stat stat--info">
      <div>
        <div className="stat-val">{value.toLocaleString()}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}

function GroupView({ groupId, nested = false }: { groupId: string; nested?: boolean }) {
  const q = useGroups(groupId);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<GroupChild | null>(null);
  const status = useGroupStatus(groupId);
  if (q.isPending) return <p>Loading…</p>;
  if (q.isError) return <CAlert color="danger">{errText(q.error)}</CAlert>;
  const d = q.data;
  const child = d.childLevel ? LEVEL_NAME[d.childLevel] : null;

  return (
    <>
      <div className="dash-head">
        <div>
          <h1>{nested ? d.group.name : "Groups"}</h1>
          <p className="dash-sub">
            {LEVEL_LABEL[d.group.level]} · {d.items.length}{" "}
            {d.items.length === 1 ? "group" : "groups"} directly under it
          </p>
        </div>
        {d.canManage && child ? (
          <CButton color="primary" onClick={() => setCreating(true)}>
            <Plus className="ic" aria-hidden /> New {child.one}
          </CButton>
        ) : null}
      </div>
      {status.error ? <CAlert color="danger">{errText(status.error)}</CAlert> : null}
      <div className="card panel">
        <CTable hover responsive className="cms-table mb-0">
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>Name</CTableHeaderCell>
              <CTableHeaderCell>Level</CTableHeaderCell>
              <CTableHeaderCell>Members</CTableHeaderCell>
              <CTableHeaderCell>Groups under it</CTableHeaderCell>
              <CTableHeaderCell />
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {d.items.map((c) => (
              <CTableRow key={c.id}>
                <CTableDataCell>
                  {c.hidden ? (
                    <span className="text-body-secondary">
                      <EyeOff className="ic" aria-hidden /> {c.name}
                    </span>
                  ) : (
                    <Link to={`/admin/groups/${c.id}`}>
                      <b>{c.name}</b>
                    </Link>
                  )}{" "}
                  {!c.isActive ? <CBadge color="secondary">Closed</CBadge> : null}
                  {c.code ? <div className="small text-body-secondary">{c.code}</div> : null}
                  {c.hidden ? (
                    <div className="small text-body-secondary">
                      This diocese has chosen not to share its figures.
                    </div>
                  ) : null}
                </CTableDataCell>
                <CTableDataCell>{LEVEL_LABEL[c.level]}</CTableDataCell>
                <CTableDataCell>{c.hidden ? "—" : c.members.toLocaleString()}</CTableDataCell>
                <CTableDataCell>{c.hidden ? "—" : c.openChildren}</CTableDataCell>
                <CTableDataCell className="text-end">
                  {d.canManage ? (
                    <>
                      <CButton
                        size="sm"
                        color="secondary"
                        variant="ghost"
                        onClick={() => setEditing(c)}
                      >
                        Rename
                      </CButton>
                      <CButton
                        size="sm"
                        color={c.isActive ? "danger" : "success"}
                        variant="ghost"
                        disabled={status.isPending}
                        onClick={() =>
                          (c.isActive
                            ? confirm(
                                `Close ${c.name}? It will no longer appear when people sign up or join. Its records are kept.`,
                              )
                            : true) && status.mutate({ id: c.id, isActive: !c.isActive })
                        }
                      >
                        {c.isActive ? "Close" : "Reopen"}
                      </CButton>
                    </>
                  ) : null}
                </CTableDataCell>
              </CTableRow>
            ))}
            {!d.items.length ? (
              <CTableRow>
                <CTableDataCell colSpan={5} className="text-body-secondary">
                  Nothing under {d.group.name} yet.
                </CTableDataCell>
              </CTableRow>
            ) : null}
          </CTableBody>
        </CTable>
      </div>
      {!d.canManage && d.childLevel && !nested ? (
        <p className="small text-body-secondary mt-2">
          Only this church's Administrators open new {LEVEL_NAME[d.childLevel].many}.
        </p>
      ) : null}
      {!d.childLevel && !nested ? (
        <p className="small text-body-secondary mt-2">
          New groups at this level are opened by Ecclesios. Contact support.
        </p>
      ) : null}
      {creating && d.childLevel ? (
        <CreateModal groupId={groupId} level={d.childLevel} onClose={() => setCreating(false)} />
      ) : null}
      {editing ? (
        <RenameModal groupId={groupId} child={editing} onClose={() => setEditing(null)} />
      ) : null}
    </>
  );
}

function CreateModal({
  groupId,
  level,
  onClose,
}: {
  groupId: string;
  level: HierarchyLevel;
  onClose: () => void;
}) {
  const create = useCreateGroup(groupId);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [codeTouched, setCodeTouched] = useState(false);
  const [admin, setAdmin] = useState<{ id: string; name: string } | null>(null);
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);
  const people = useRegister(groupId, { ...EMPTY_FILTERS, q: term }, 1);
  const what = LEVEL_NAME[level].one;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate(
      { name, code: code || null, administratorPersonId: admin?.id ?? null },
      { onSuccess: onClose },
    );
  };
  return (
    <CModal visible onClose={onClose} alignment="center">
      <CForm onSubmit={submit}>
        <CModalHeader>
          <CModalTitle>New {what}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {create.error ? <CAlert color="danger">{errText(create.error)}</CAlert> : null}
          <CFormLabel htmlFor="gn">Name</CFormLabel>
          <CFormInput
            id="gn"
            value={name}
            required
            maxLength={200}
            className="mb-3"
            placeholder={`St Jude ${cap(what)}`}
            onChange={(e) => {
              setName(e.target.value);
              if (!codeTouched) setCode(suggestCode(e.target.value));
            }}
          />
          <CFormLabel htmlFor="gc">Code (optional)</CFormLabel>
          <CFormInput
            id="gc"
            value={code}
            maxLength={50}
            onChange={(e) => (setCode(e.target.value.toUpperCase()), setCodeTouched(true))}
          />
          <CFormText className="mb-3 d-block">
            A short reference used in reports. Letters, numbers and dashes.
          </CFormText>
          <CFormLabel>Administrator (optional)</CFormLabel>
          {admin ? (
            <div className="d-flex align-items-center gap-2">
              <b>{admin.name}</b>
              <CButton size="sm" color="secondary" variant="ghost" onClick={() => setAdmin(null)}>
                Change
              </CButton>
            </div>
          ) : (
            <>
              <CFormInput
                placeholder="Search members of this church"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              {term ? (
                <ul
                  className="list-unstyled mt-2 mb-0"
                  style={{ maxHeight: 180, overflowY: "auto" }}
                >
                  {people.data?.items
                    .filter((p) => p.church.id === groupId)
                    .map((p) => (
                      <li key={p.personId}>
                        <CButton
                          size="sm"
                          color="link"
                          className="px-0"
                          onClick={() =>
                            setAdmin({ id: p.personId, name: `${p.firstName} ${p.lastName}` })
                          }
                        >
                          {p.firstName} {p.lastName}
                        </CButton>
                      </li>
                    ))}
                </ul>
              ) : null}
            </>
          )}
          <CFormText className="d-block mt-2">
            They'll run the new {what} in Church Management, as well as staying a member here. You
            can also add one later.
          </CFormText>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="ghost" onClick={onClose}>
            Cancel
          </CButton>
          <CButton
            type="submit"
            color="primary"
            disabled={create.isPending || name.trim().length < 3}
          >
            {create.isPending ? "Creating…" : "Create"}
          </CButton>
        </CModalFooter>
      </CForm>
    </CModal>
  );
}

function RenameModal({
  groupId,
  child,
  onClose,
}: {
  groupId: string;
  child: GroupChild;
  onClose: () => void;
}) {
  const update = useUpdateGroup(groupId);
  const [name, setName] = useState(child.name);
  const [code, setCode] = useState(child.code ?? "");
  return (
    <CModal visible onClose={onClose} alignment="center">
      <CForm
        onSubmit={(e) => {
          e.preventDefault();
          update.mutate(
            { id: child.id, body: { name, code: code || null } },
            { onSuccess: onClose },
          );
        }}
      >
        <CModalHeader>
          <CModalTitle>Rename {LEVEL_LABEL[child.level]?.toLowerCase()}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {update.error ? <CAlert color="danger">{errText(update.error)}</CAlert> : null}
          <CFormLabel htmlFor="rn">Name</CFormLabel>
          <CFormInput
            id="rn"
            value={name}
            required
            maxLength={200}
            className="mb-3"
            onChange={(e) => setName(e.target.value)}
          />
          <CFormLabel htmlFor="rc">Code</CFormLabel>
          <CFormInput
            id="rc"
            value={code}
            maxLength={50}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="ghost" onClick={onClose}>
            Cancel
          </CButton>
          <CButton
            type="submit"
            color="primary"
            disabled={update.isPending || name.trim().length < 3}
          >
            Save
          </CButton>
        </CModalFooter>
      </CForm>
    </CModal>
  );
}
