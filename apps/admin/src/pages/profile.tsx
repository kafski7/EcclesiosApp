import { CAlert, CButton, CForm, CFormInput, CFormLabel, CFormText } from "@coreui/react";
import type { OwnProfile } from "@ecclesios/shared";
import { useState, type FormEvent } from "react";
import { useOwnPhoto, useOwnProfile, useSaveOwnProfile } from "@/lib/account";
import { ApiClientError } from "@/lib/api";
import { changePassword } from "@/lib/auth";
import { useSession } from "@/stores/session";
import { useMutation } from "@tanstack/react-query";

const errText = (e: unknown) =>
  e instanceof ApiClientError
    ? e.message
    : e instanceof Error
      ? e.message
      : "Something went wrong.";

/** Your own profile (functionality §4.9, D-039). Platform accounts only get the password section. */
export function ProfilePage() {
  const principal = useSession((s) => s.principal);
  const isMember = principal?.kind === "member";
  const q = useOwnProfile(isMember);
  return (
    <>
      <div className="dash-head">
        <div>
          <h1>Your profile</h1>
          <p className="dash-sub">
            {isMember ? "Your contact details, photo and password." : "Your password."}
          </p>
        </div>
      </div>
      <div className="row g-3">
        {isMember ? (
          <div className="col-lg-7">
            {q.data ? (
              <Details key={q.data.id} p={q.data} />
            ) : q.isError ? (
              <CAlert color="danger">{errText(q.error)}</CAlert>
            ) : (
              <p>Loading…</p>
            )}
          </div>
        ) : null}
        <div className="col-lg-5">
          <Password />
        </div>
      </div>
    </>
  );
}

function Details({ p }: { p: OwnProfile }) {
  const save = useSaveOwnProfile();
  const photo = useOwnPhoto();
  const [email, setEmail] = useState(p.email ?? "");
  const [telephone, setTelephone] = useState(p.telephone ?? "");
  const [address, setAddress] = useState(p.address ?? "");
  const [occupation, setOccupation] = useState(p.occupation ?? "");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate({ email, telephone, address, occupation });
  };
  return (
    <CForm onSubmit={submit} className="card panel">
      <div className="d-flex align-items-center gap-3 mb-3">
        {p.photoUrl ? (
          <img src={p.photoUrl} alt="" className="reg-photo" style={{ width: 64, height: 64 }} />
        ) : (
          <span
            className="reg-photo reg-photo-blank"
            style={{ width: 64, height: 64, fontSize: 24 }}
            aria-hidden
          >
            {p.firstName[0]}
            {p.lastName[0]}
          </span>
        )}
        <div>
          <b>
            {p.firstName} {p.otherNames ? `${p.otherNames} ` : ""}
            {p.lastName}
          </b>
          <div className="small text-body-secondary">
            {p.homeChurch ? `Home church: ${p.homeChurch.name}` : "No home church yet"}
          </div>
          <label className="small link" style={{ cursor: "pointer" }}>
            {photo.isPending ? "Uploading…" : "Change photo"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(e) => e.target.files?.[0] && photo.mutate(e.target.files[0])}
            />
          </label>
        </div>
      </div>
      {photo.error ? <CAlert color="danger">{errText(photo.error)}</CAlert> : null}
      {save.error ? <CAlert color="danger">{errText(save.error)}</CAlert> : null}
      {save.isSuccess ? <CAlert color="success">Saved.</CAlert> : null}
      <CFormLabel htmlFor="pe">Email</CFormLabel>
      <CFormInput
        id="pe"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="mb-3"
      />
      <CFormLabel htmlFor="pt">Phone</CFormLabel>
      <CFormInput
        id="pt"
        value={telephone}
        placeholder="024 123 4567"
        onChange={(e) => setTelephone(e.target.value)}
      />
      <CFormText className="mb-3 d-block">
        You sign in with your email or phone, so keep at least one.
      </CFormText>
      <CFormLabel htmlFor="pa">Address</CFormLabel>
      <CFormInput
        id="pa"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        className="mb-3"
      />
      <CFormLabel htmlFor="po">Occupation</CFormLabel>
      <CFormInput
        id="po"
        value={occupation}
        onChange={(e) => setOccupation(e.target.value)}
        className="mb-3"
      />
      <CFormText className="mb-3 d-block">
        Your name, date of birth and sacraments are kept by your home church. Ask them to correct
        anything wrong.
      </CFormText>
      <CButton
        type="submit"
        color="primary"
        disabled={save.isPending}
        style={{ alignSelf: "flex-start" }}
      >
        {save.isPending ? "Saving…" : "Save"}
      </CButton>
    </CForm>
  );
}

function Password() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const m = useMutation({
    mutationFn: () => changePassword(current, next),
    onSuccess: () => (setCurrent(""), setNext(""), setAgain("")),
  });
  const mismatch = again.length > 0 && again !== next;
  return (
    <CForm
      className="card panel"
      onSubmit={(e) => {
        e.preventDefault();
        if (!mismatch) m.mutate();
      }}
    >
      <b className="mb-3">Change password</b>
      {m.error ? <CAlert color="danger">{errText(m.error)}</CAlert> : null}
      {m.isSuccess ? (
        <CAlert color="success">
          Password changed. You've been signed out on your other devices.
        </CAlert>
      ) : null}
      <CFormLabel htmlFor="pc">Current password</CFormLabel>
      <CFormInput
        id="pc"
        type="password"
        autoComplete="current-password"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        className="mb-3"
        required
      />
      <CFormLabel htmlFor="pn">New password</CFormLabel>
      <CFormInput
        id="pn"
        type="password"
        autoComplete="new-password"
        value={next}
        onChange={(e) => setNext(e.target.value)}
        required
      />
      <CFormText className="mb-3 d-block">
        At least 10 characters, with a letter and a number.
      </CFormText>
      <CFormLabel htmlFor="pa2">New password again</CFormLabel>
      <CFormInput
        id="pa2"
        type="password"
        autoComplete="new-password"
        value={again}
        onChange={(e) => setAgain(e.target.value)}
        invalid={mismatch}
        className="mb-3"
        required
      />
      <CButton
        type="submit"
        color="primary"
        disabled={m.isPending || !current || !next || mismatch}
        style={{ alignSelf: "flex-start" }}
      >
        {m.isPending ? "Changing…" : "Change password"}
      </CButton>
    </CForm>
  );
}
