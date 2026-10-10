import {
  CAlert,
  CBadge,
  CButton,
  CForm,
  CFormInput,
  CFormLabel,
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CNav,
  CNavItem,
  CNavLink,
} from "@coreui/react";
import type { SocietyKind } from "@ecclesios/shared/domain";
import { Plus, UsersRound } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiClientError } from "@/lib/api";
import { useCurrent } from "@/lib/cms";
import { EMPTY_FILTERS, useRegister } from "@/lib/register";
import { KIND_TEXT, useCreateSociety, useSocieties } from "@/lib/societies";

export const errText = (e: unknown) =>
  e instanceof ApiClientError
    ? e.message
    : e instanceof Error
      ? e.message
      : "Something went wrong.";
const isStaff = (role: string) => role === "ADMINISTRATOR" || role === "MANAGER";

/** Societies or committees of the current church (functionality §4.4–4.5, D-038). */
export function SocietiesPage({ kind }: { kind: SocietyKind }) {
  const ctx = useCurrent();
  const [archived, setArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const list = useSocieties(ctx.group.id, kind, archived);
  const text = KIND_TEXT[kind];
  const staff = isStaff(ctx.role);

  return (
    <>
      <div className="dash-head">
        <div>
          <h1>{text.many}</h1>
          <p className="dash-sub">
            {ctx.group.name}
            {staff ? "" : ` · the ${kind === "COMMITTEE" ? "committees" : "societies"} you lead`}
          </p>
        </div>
        {staff ? (
          <CButton color="primary" onClick={() => setCreating(true)}>
            <Plus className="ic" aria-hidden /> New {text.one}
          </CButton>
        ) : null}
      </div>

      {staff ? (
        <CNav variant="underline" className="mb-3">
          <CNavItem>
            <CNavLink as="button" active={!archived} onClick={() => setArchived(false)}>
              Current
            </CNavLink>
          </CNavItem>
          <CNavItem>
            <CNavLink as="button" active={archived} onClick={() => setArchived(true)}>
              Archived
            </CNavLink>
          </CNavItem>
        </CNav>
      ) : null}

      {list.isError ? <CAlert color="danger">{errText(list.error)}</CAlert> : null}
      {list.data && !list.data.items.length ? (
        <div className="card panel text-body-secondary">
          {archived
            ? `No archived ${text.many.toLowerCase()}.`
            : staff
              ? `No ${text.many.toLowerCase()} yet.`
              : `You don't lead any ${text.many.toLowerCase()} here.`}
        </div>
      ) : null}
      <div className="row g-3">
        {list.data?.items.map((s) => (
          <div className="col-md-6 col-xl-4" key={s.id}>
            <Link
              to={`${text.path}/${s.id}`}
              className="card panel h-100 d-block text-reset text-decoration-none"
            >
              <div className="d-flex align-items-start gap-2">
                <UsersRound className="ic mt-1" aria-hidden />
                <div className="flex-grow-1 min-w-0">
                  <b>{s.name}</b>
                  {!s.isActive ? (
                    <CBadge color="secondary" className="ms-2">
                      Archived
                    </CBadge>
                  ) : null}
                  <div className="small text-body-secondary">
                    {s.rosterCount} {s.rosterCount === 1 ? "person" : "people"} ·{" "}
                    {s.leader ? `Led by ${s.leader.name}` : "No leader"}
                  </div>
                  {s.description ? (
                    <p className="small mt-2 mb-0 text-body-secondary">
                      {s.description.slice(0, 140)}
                    </p>
                  ) : null}
                </div>
              </div>
            </Link>
          </div>
        ))}
      </div>
      {creating ? <CreateModal kind={kind} onClose={() => setCreating(false)} /> : null}
    </>
  );
}

function CreateModal({ kind, onClose }: { kind: SocietyKind; onClose: () => void }) {
  const ctx = useCurrent();
  const navigate = useNavigate();
  const create = useCreateSociety(ctx.group.id);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [leader, setLeader] = useState<{ id: string; name: string } | null>(null);
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setTerm(q), 250);
    return () => clearTimeout(t);
  }, [q]);
  const people = useRegister(ctx.group.id, { ...EMPTY_FILTERS, q: term }, 1);
  const text = KIND_TEXT[kind];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate(
      { kind, name, description: description.trim() || null, leaderPersonId: leader?.id ?? null },
      { onSuccess: (s) => navigate(`${text.path}/${s.id}`) },
    );
  };

  return (
    <CModal visible onClose={onClose} alignment="center">
      <CForm onSubmit={submit}>
        <CModalHeader>
          <CModalTitle>New {text.one}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {create.error ? <CAlert color="danger">{errText(create.error)}</CAlert> : null}
          <CFormLabel htmlFor="sn">Name</CFormLabel>
          <CFormInput
            id="sn"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={200}
            className="mb-3"
          />
          <CFormLabel htmlFor="sd">Description (optional)</CFormLabel>
          <CFormTextarea
            id="sd"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mb-3"
          />
          <CFormLabel>Leader (optional)</CFormLabel>
          {leader ? (
            <div className="d-flex align-items-center gap-2 mb-1">
              <b>{leader.name}</b>
              <CButton size="sm" color="secondary" variant="ghost" onClick={() => setLeader(null)}>
                Change
              </CButton>
            </div>
          ) : (
            <>
              <CFormInput
                placeholder="Search this church's members"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              {term.trim() ? (
                <ul
                  className="list-unstyled mt-2 mb-0"
                  style={{ maxHeight: 180, overflowY: "auto" }}
                >
                  {people.data?.items.map((p) => (
                    <li key={p.personId}>
                      <CButton
                        size="sm"
                        color="link"
                        className="px-0"
                        onClick={() =>
                          setLeader({ id: p.personId, name: `${p.firstName} ${p.lastName}` })
                        }
                      >
                        {p.firstName} {p.lastName}
                      </CButton>
                      <span className="small text-body-secondary">
                        {" "}
                        · {p.telephone ?? p.email ?? ""}
                      </span>
                    </li>
                  ))}
                  {people.data && !people.data.items.length ? (
                    <li className="small text-body-secondary">No one found.</li>
                  ) : null}
                </ul>
              ) : null}
            </>
          )}
          <p className="small text-body-secondary mt-2 mb-0">
            The leader can keep the roster from this console. A Parishioner chosen as leader becomes
            a Society-Leader in this church.
          </p>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="ghost" onClick={onClose}>
            Cancel
          </CButton>
          <CButton
            type="submit"
            color="primary"
            disabled={create.isPending || name.trim().length < 2}
          >
            {create.isPending ? "Creating…" : "Create"}
          </CButton>
        </CModalFooter>
      </CForm>
    </CModal>
  );
}
