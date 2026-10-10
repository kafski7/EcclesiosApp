import {
  CAlert,
  CBadge,
  CButton,
  CForm,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
} from "@coreui/react";
import type { MemberProfile, PersonDetails } from "@ecclesios/shared";
import {
  isPhone,
  MEMBER_ROLES,
  PHONE_HINT,
  recordProblems,
  type MemberRole,
} from "@ecclesios/shared/domain";
import { ArrowLeft, Printer } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ApiClientError } from "@/lib/api";
import { fieldErrors } from "@/lib/auth-errors";
import { formatDate, LEVEL_LABEL, useCurrent } from "@/lib/cms";
import {
  localToday,
  ROLE_LABEL,
  useAddMember,
  useChangeRole,
  useProfile,
  useRemoveMember,
  useSaveMember,
  useSetPhoto,
} from "@/lib/register";
import { Avatar } from "./members";

const errText = (e: unknown) =>
  e instanceof ApiClientError
    ? e.message
    : e instanceof Error
      ? e.message
      : "Something went wrong.";

type Form = Required<{ [K in keyof PersonDetails]: Exclude<PersonDetails[K], undefined> }>;
const EMPTY: Form = {
  firstName: "",
  otherNames: null,
  lastName: "",
  gender: null,
  dateOfBirth: null,
  email: null,
  telephone: null,
  address: null,
  occupation: null,
  isBaptised: false,
  baptismDate: null,
  baptismPlace: null,
  isCommunicant: false,
  firstCommunionDate: null,
  isConfirmed: false,
  confirmationDate: null,
  isDeceased: false,
  deceasedOn: null,
};

const fromProfile = (p: MemberProfile["person"]): Form => ({
  firstName: p.firstName,
  otherNames: p.otherNames,
  lastName: p.lastName,
  gender: p.gender,
  dateOfBirth: p.dateOfBirth,
  email: p.email,
  telephone: p.telephone,
  address: p.address,
  occupation: p.occupation,
  isBaptised: p.isBaptised,
  baptismDate: p.baptismDate,
  baptismPlace: p.baptismPlace,
  isCommunicant: p.isCommunicant,
  firstCommunionDate: p.firstCommunionDate,
  isConfirmed: p.isConfirmed,
  confirmationDate: p.confirmationDate,
  isDeceased: p.isDeceased,
  deceasedOn: p.deceasedOn,
});

/** Member profile and record (functionality §4.2, D-016, D-037). ?church= views an outstation member from the parish. */
export function MemberPage() {
  const ctx = useCurrent();
  const { personId } = useParams();
  const [params] = useSearchParams();
  const churchId = params.get("church") ?? ctx.group.id;
  const isNew = personId === "new";
  const q = useProfile(churchId, isNew ? undefined : personId);
  if (isNew) return <NewMember />;
  if (q.isPending) return <p className="muted">Loading…</p>;
  if (q.isError) return <CAlert color="danger">{errText(q.error)}</CAlert>;
  return <Profile key={q.data.person.id} p={q.data} churchId={churchId} />;
}

function Back() {
  return (
    <Link to="/admin/members" className="link mb-3 d-inline-flex align-items-center gap-1 no-print">
      <ArrowLeft className="ic" aria-hidden /> Members
    </Link>
  );
}

function NewMember() {
  const ctx = useCurrent();
  const navigate = useNavigate();
  const add = useAddMember(ctx.group.id);
  const [role, setRole] = useState<MemberRole>("PARISHIONER");
  return (
    <>
      <Back />
      <div className="dash-head">
        <div>
          <h1>Add a member</h1>
          <p className="dash-sub">
            For people who don't use the app. Anyone with the app should join {ctx.group.name} from
            their phone instead — you'll see their request under Members → Requests.
          </p>
        </div>
      </div>
      <RecordForm
        initial={EMPTY}
        submitLabel="Add to register"
        pending={add.isPending}
        error={add.error}
        extra={
          ctx.role === "ADMINISTRATOR" ? (
            <div className="col-md-4">
              <CFormLabel htmlFor="nr">Role here</CFormLabel>
              <CFormSelect
                id="nr"
                value={role}
                onChange={(e) => setRole(e.target.value as MemberRole)}
              >
                {MEMBER_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </CFormSelect>
            </div>
          ) : null
        }
        onSubmit={(d) =>
          add.mutate(
            { ...d, role },
            { onSuccess: (p) => navigate(`/admin/members/${p.person.id}`, { replace: true }) },
          )
        }
      />
    </>
  );
}

function Profile({ p, churchId }: { p: MemberProfile; churchId: string }) {
  const ctx = useCurrent();
  const navigate = useNavigate();
  const save = useSaveMember(churchId, p.person.id);
  const role = useChangeRole(churchId, p.person.id);
  const photo = useSetPhoto(churchId, p.person.id);
  const remove = useRemoveMember(churchId, p.person.id);
  const [editing, setEditing] = useState(false);
  const x = p.person;
  const name = [x.firstName, x.otherNames, x.lastName].filter(Boolean).join(" ");
  const err = role.error ?? photo.error ?? remove.error;

  return (
    <>
      <Back />
      <section className="card panel mb-4">
        <div className="d-flex flex-wrap gap-4 align-items-start">
          <div className="text-center">
            <Avatar url={x.photoUrl} name={name} size={96} />
            {p.can.edit ? (
              <div className="mt-2 no-print">
                <label className="small link" style={{ cursor: "pointer" }}>
                  {photo.isPending ? "Uploading…" : x.photoUrl ? "Change photo" : "Add photo"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) photo.mutate(f);
                      e.target.value = "";
                    }}
                  />
                </label>
                {x.photoUrl ? (
                  <button
                    type="button"
                    className="small link d-block mx-auto"
                    onClick={() => photo.mutate(null)}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="flex-grow-1">
            <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>
              {name}{" "}
              {x.isDeceased ? (
                <CBadge color="dark">
                  deceased{x.deceasedOn ? ` · ${formatDate(x.deceasedOn)}` : ""}
                </CBadge>
              ) : null}
            </h1>
            <p className="small muted mb-2">
              {p.here
                ? `${ROLE_LABEL[p.here.role]} · ${p.here.status === "LEFT" ? "former member" : "member"}${p.here.isHome ? " · home church" : ""}`
                : ""}
              {x.hasAccount ? " · uses the Ecclesios app" : " · no app account"}
            </p>
            <div className="d-flex gap-2 flex-wrap no-print">
              {p.can.edit && !editing ? (
                <CButton size="sm" color="primary" onClick={() => setEditing(true)}>
                  Edit record
                </CButton>
              ) : null}
              <CButton size="sm" color="secondary" variant="outline" onClick={() => window.print()}>
                <Printer className="ic" aria-hidden /> Print
              </CButton>
            </div>
            {!p.can.edit ? (
              <p className="small muted mt-2 mb-0">
                Only this person's home church (or its parish) can change their record.
              </p>
            ) : null}
          </div>
        </div>
        {err ? (
          <CAlert color="danger" className="mt-3">
            {errText(err)}
          </CAlert>
        ) : null}
      </section>

      {editing ? (
        <RecordForm
          initial={fromProfile(x)}
          submitLabel="Save record"
          pending={save.isPending}
          error={save.error}
          onCancel={() => setEditing(false)}
          onSubmit={(d) => save.mutate(d, { onSuccess: () => setEditing(false) })}
        />
      ) : (
        <div className="row g-4">
          <div className="col-lg-6">
            <section className="card panel h-100">
              <h2 className="panel-title mb-3">Personal details</h2>
              <Facts
                rows={[
                  [
                    "Gender",
                    x.gender === "MALE" ? "Male" : x.gender === "FEMALE" ? "Female" : null,
                  ],
                  ["Date of birth", formatDate(x.dateOfBirth)],
                  ["Telephone", x.telephone],
                  ["Email", x.email],
                  ["Address", x.address],
                  ["Occupation", x.occupation],
                ]}
              />
            </section>
          </div>
          <div className="col-lg-6">
            <section className="card panel h-100">
              <h2 className="panel-title mb-3">Sacraments</h2>
              <Facts
                rows={[
                  [
                    "Baptism",
                    x.isBaptised
                      ? [formatDate(x.baptismDate) || "Yes", x.baptismPlace]
                          .filter(Boolean)
                          .join(" · ")
                      : "Not recorded",
                  ],
                  [
                    "First Communion",
                    x.isCommunicant ? formatDate(x.firstCommunionDate) || "Yes" : "Not recorded",
                  ],
                  [
                    "Confirmation",
                    x.isConfirmed ? formatDate(x.confirmationDate) || "Yes" : "Not recorded",
                  ],
                ]}
              />
            </section>
          </div>
          <div className="col-lg-6">
            <section className="card panel h-100">
              <h2 className="panel-title mb-3">Churches</h2>
              <ul className="list-unstyled mb-0">
                {p.memberships.map((m) => (
                  <li key={m.id} className="mb-2">
                    <b>{m.church.name}</b>{" "}
                    <span className="small muted">
                      ({LEVEL_LABEL[m.church.level] ?? m.church.level})
                    </span>
                    <div className="small muted">
                      {ROLE_LABEL[m.role]} · {m.status.toLowerCase()}
                      {m.isHome ? " · home church" : ""} · since {formatDate(m.joinedAt)}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>
          <div className="col-lg-6">
            <section className="card panel h-100">
              <h2 className="panel-title mb-3">Societies here</h2>
              {p.societies.length ? (
                <ul className="list-unstyled mb-0">
                  {p.societies.map((s) => (
                    <li key={s.id}>
                      {s.name} {s.isCommittee ? <CBadge color="secondary">committee</CBadge> : null}
                      {s.position ? <span className="small muted"> · {s.position}</span> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="small muted mb-0">None.</p>
              )}
            </section>
          </div>
        </div>
      )}

      {p.can.manageRole && p.here && !editing ? (
        <section className="card panel mt-4 no-print">
          <h2 className="panel-title mb-3">
            In {churchId === ctx.group.id ? ctx.group.name : "this church"}
          </h2>
          <div className="d-flex flex-wrap gap-3 align-items-end">
            <div>
              <CFormLabel htmlFor="role">Role</CFormLabel>
              <CFormSelect
                id="role"
                value={p.here.role}
                disabled={role.isPending}
                onChange={(e) => role.mutate(e.target.value as MemberRole)}
              >
                {MEMBER_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </CFormSelect>
            </div>
            {p.can.remove ? (
              <RemoveBox
                name={x.firstName}
                pending={remove.isPending}
                onRemove={(reason) =>
                  remove.mutate(reason, { onSuccess: () => navigate("/admin/members") })
                }
              />
            ) : null}
          </div>
          <p className="small muted mt-2 mb-0">
            Roles apply to this church only. Administrators and Managers can use Church Management;
            Society leaders lead societies.
          </p>
        </section>
      ) : null}
    </>
  );
}

function RemoveBox({
  name,
  pending,
  onRemove,
}: {
  name: string;
  pending: boolean;
  onRemove: (reason: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  if (!open)
    return (
      <CButton color="danger" variant="ghost" onClick={() => setOpen(true)}>
        Remove from this church
      </CButton>
    );
  return (
    <div className="d-flex gap-2 align-items-end flex-grow-1">
      <div className="flex-grow-1">
        <CFormLabel htmlFor="rr">Why is {name} leaving the register?</CFormLabel>
        <CFormInput
          id="rr"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Moved to another parish"
        />
      </div>
      <CButton
        color="danger"
        disabled={pending || reason.trim().length < 3}
        onClick={() => onRemove(reason.trim())}
      >
        Remove
      </CButton>
      <CButton color="secondary" variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </CButton>
    </div>
  );
}

function Facts({ rows }: { rows: [string, string | null][] }) {
  return (
    <dl className="facts mb-0">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v || <span className="muted">—</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Personal details + sacramental record, with the same checks the API runs. */
function RecordForm({
  initial,
  submitLabel,
  pending,
  error,
  extra,
  onSubmit,
  onCancel,
}: {
  initial: Form;
  submitLabel: string;
  pending: boolean;
  error: unknown;
  extra?: ReactNode;
  onSubmit: (d: Form) => void;
  onCancel?: () => void;
}) {
  const [f, setF] = useState<Form>(initial);
  const text = (k: keyof Form) => ({
    value: (f[k] as string | null) ?? "",
    onChange: (e: { target: { value: string } }) =>
      setF((x) => ({ ...x, [k]: e.target.value === "" ? null : e.target.value })),
  });
  const check = (k: keyof Form) => ({
    checked: Boolean(f[k]),
    onChange: (e: { target: { checked: boolean } }) =>
      setF((x) => ({ ...x, [k]: e.target.checked })),
  });
  const problems = recordProblems(f, localToday());
  // Field messages: the API's validation errors, or the phone check as you type (D-040).
  const apiFields =
    error instanceof ApiClientError && error.code === "VALIDATION_FAILED"
      ? fieldErrors(error.details)
      : {};
  const phoneBad = !!f.telephone && f.telephone.trim().length > 6 && !isPhone(f.telephone);
  const fieldMsg = (k: keyof Form) =>
    k === "telephone" && phoneBad ? PHONE_HINT : apiFields[k as string];
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!problems.length)
      onSubmit({ ...f, firstName: f.firstName.trim(), lastName: f.lastName.trim() });
  };
  return (
    <CForm onSubmit={submit} className="card panel">
      {error && !Object.keys(apiFields).length ? (
        <CAlert color="danger">{errText(error)}</CAlert>
      ) : null}
      {Object.keys(apiFields).length ? (
        <CAlert color="danger">Please correct the highlighted fields.</CAlert>
      ) : null}
      <h2 className="panel-title mb-3">Personal details</h2>
      <div className="row g-3 mb-4">
        <div className="col-md-4">
          <CFormLabel htmlFor="fn">First name</CFormLabel>
          <CFormInput
            id="fn"
            required
            invalid={!!fieldMsg("firstName")}
            feedbackInvalid={fieldMsg("firstName")}
            value={f.firstName}
            onChange={(e) => setF((x) => ({ ...x, firstName: e.target.value }))}
          />
        </div>
        <div className="col-md-4">
          <CFormLabel htmlFor="on">Other names</CFormLabel>
          <CFormInput id="on" {...text("otherNames")} />
        </div>
        <div className="col-md-4">
          <CFormLabel htmlFor="ln">Last name</CFormLabel>
          <CFormInput
            id="ln"
            required
            invalid={!!fieldMsg("lastName")}
            feedbackInvalid={fieldMsg("lastName")}
            value={f.lastName}
            onChange={(e) => setF((x) => ({ ...x, lastName: e.target.value }))}
          />
        </div>
        <div className="col-md-4">
          <CFormLabel htmlFor="gd">Gender</CFormLabel>
          <CFormSelect
            id="gd"
            value={f.gender ?? ""}
            onChange={(e) =>
              setF((x) => ({ ...x, gender: (e.target.value || null) as Form["gender"] }))
            }
          >
            <option value="">—</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
          </CFormSelect>
        </div>
        <div className="col-md-4">
          <CFormLabel htmlFor="db">Date of birth</CFormLabel>
          <CFormInput id="db" type="date" {...text("dateOfBirth")} />
        </div>
        <div className="col-md-4">
          <CFormLabel htmlFor="oc">Occupation</CFormLabel>
          <CFormInput id="oc" {...text("occupation")} />
        </div>
        <div className="col-md-4">
          <CFormLabel htmlFor="tl">Telephone</CFormLabel>
          <CFormInput
            id="tl"
            placeholder="024 123 4567"
            inputMode="tel"
            {...text("telephone")}
            invalid={!!fieldMsg("telephone")}
            feedbackInvalid={fieldMsg("telephone")}
          />
        </div>
        <div className="col-md-8">
          <CFormLabel htmlFor="em">Email</CFormLabel>
          <CFormInput
            id="em"
            type="email"
            {...text("email")}
            invalid={!!fieldMsg("email")}
            feedbackInvalid={fieldMsg("email")}
          />
        </div>
        <div className="col-12">
          <CFormLabel htmlFor="ad">Address</CFormLabel>
          <CFormTextarea id="ad" rows={2} {...text("address")} />
        </div>
        {extra}
      </div>

      <h2 className="panel-title mb-3">Sacraments</h2>
      <div className="row g-3 mb-3">
        <div className="col-md-3 pt-md-4">
          <CFormCheck id="b" label="Baptised" {...check("isBaptised")} />
        </div>
        <div className="col-md-3">
          <CFormLabel htmlFor="bd">Baptism date</CFormLabel>
          <CFormInput id="bd" type="date" {...text("baptismDate")} />
        </div>
        <div className="col-md-6">
          <CFormLabel htmlFor="bp">Place of baptism</CFormLabel>
          <CFormInput id="bp" {...text("baptismPlace")} />
        </div>
        <div className="col-md-3 pt-md-4">
          <CFormCheck id="c" label="First Communion" {...check("isCommunicant")} />
        </div>
        <div className="col-md-3">
          <CFormLabel htmlFor="cd">Date</CFormLabel>
          <CFormInput id="cd" type="date" {...text("firstCommunionDate")} />
        </div>
        <div className="col-md-3 pt-md-4">
          <CFormCheck id="cf" label="Confirmed" {...check("isConfirmed")} />
        </div>
        <div className="col-md-3">
          <CFormLabel htmlFor="cfd">Date</CFormLabel>
          <CFormInput id="cfd" type="date" {...text("confirmationDate")} />
        </div>
        <div className="col-md-3 pt-md-4">
          <CFormCheck id="dc" label="Deceased" {...check("isDeceased")} />
        </div>
        <div className="col-md-3">
          <CFormLabel htmlFor="dd">Date of death</CFormLabel>
          <CFormInput id="dd" type="date" {...text("deceasedOn")} />
        </div>
      </div>
      {problems.length ? (
        <ul className="small text-danger">
          {problems.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      ) : null}
      <div className="d-flex gap-2">
        <CButton
          type="submit"
          color="primary"
          disabled={
            pending || problems.length > 0 || phoneBad || !f.firstName.trim() || !f.lastName.trim()
          }
        >
          {pending ? "Saving…" : submitLabel}
        </CButton>
        {onCancel ? (
          <CButton color="secondary" variant="ghost" onClick={onCancel}>
            Cancel
          </CButton>
        ) : null}
      </div>
    </CForm>
  );
}
