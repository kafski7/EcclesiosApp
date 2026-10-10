import type { OwnProfile } from "@ecclesios/shared";
import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  useNotificationPreferences,
  useOwnPhoto,
  useOwnProfile,
  useSaveNotificationPreference,
  useSaveOwnProfile,
} from "@/lib/account";
import { ApiClientError } from "@/lib/api";
import { changePassword } from "@/lib/auth";
import { env } from "@/lib/env";
import { useSignInHere } from "@/components/auth/sign-in-link";
import { useSession } from "@/stores/session";

const errText = (e: unknown) =>
  e instanceof ApiClientError
    ? e.message
    : e instanceof Error
      ? e.message
      : "Something went wrong.";

/** Your account (functionality §4.9, D-039): contact details, photo and password. */
export function AccountPage() {
  const principal = useSession((s) => s.principal);
  const signIn = useSignInHere();
  const q = useOwnProfile();
  if (!principal) return <Navigate to={signIn} replace />;
  if (principal.kind !== "member")
    return (
      <div className="content-narrow mx-auto card rail-card">
        Platform accounts manage their password in the{" "}
        <a className="link" href={`${env.VITE_ADMIN_URL}/platform/profile`}>
          platform console
        </a>
        .
      </div>
    );
  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <header className="page-head">
        <h1 className="page-title">Your account</h1>
        <p className="page-sub">Your contact details, photo, password and notifications.</p>
      </header>
      <div className="acct-grid">
        {q.data ? (
          <Details key={q.data.id} p={q.data} />
        ) : (
          <p className="muted small">{q.isError ? errText(q.error) : "Loading…"}</p>
        )}
        <Password />
        <NotificationSettings />
      </div>
    </div>
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
    <form className="card rail-card flex flex-col gap-3" onSubmit={submit}>
      <div className="flex items-center gap-3">
        {p.photoUrl ? (
          <img src={p.photoUrl} alt="" className="acct-photo" />
        ) : (
          <span className="avatar av-48 av-brand">
            {p.firstName[0]}
            {p.lastName[0]}
          </span>
        )}
        <div>
          <b>
            {p.firstName} {p.lastName}
          </b>
          <div className="small muted">
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
      {photo.error ? (
        <p className="small" style={{ color: "var(--danger)" }}>
          {errText(photo.error)}
        </p>
      ) : null}
      <label>
        <span className="field-label">Email</span>
        <input
          className="field-input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label>
        <span className="field-label">Phone</span>
        <input
          className="field-input"
          value={telephone}
          placeholder="024 123 4567"
          onChange={(e) => setTelephone(e.target.value)}
        />
        <span className="small muted">
          You sign in with your email or phone, so keep at least one.
        </span>
      </label>
      <label>
        <span className="field-label">Address</span>
        <input
          className="field-input"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
      </label>
      <label>
        <span className="field-label">Occupation</span>
        <input
          className="field-input"
          value={occupation}
          onChange={(e) => setOccupation(e.target.value)}
        />
      </label>
      <p className="small muted">
        Your name, date of birth and sacraments are kept by your home church. Ask them to correct
        anything wrong. See{" "}
        <Link className="link" to="/me#churches">
          your churches
        </Link>
        .
      </p>
      {save.error ? (
        <p className="small" style={{ color: "var(--danger)" }}>
          {errText(save.error)}
        </p>
      ) : null}
      {save.isSuccess ? (
        <p className="small" style={{ color: "var(--success)" }}>
          Saved.
        </p>
      ) : null}
      <button type="submit" className="btn btn-primary btn-sm self-start" disabled={save.isPending}>
        {save.isPending ? "Saving…" : "Save"}
      </button>
    </form>
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
    <form
      className="card rail-card flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!mismatch) m.mutate();
      }}
    >
      <b>Change password</b>
      <label>
        <span className="field-label">Current password</span>
        <input
          className="field-input"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
        />
      </label>
      <label>
        <span className="field-label">New password</span>
        <input
          className="field-input"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
        />
        <span className="small muted">At least 10 characters, with a letter and a number.</span>
      </label>
      <label>
        <span className="field-label">New password again</span>
        <input
          className="field-input"
          type="password"
          autoComplete="new-password"
          value={again}
          onChange={(e) => setAgain(e.target.value)}
          required
        />
        {mismatch ? (
          <span className="small" style={{ color: "var(--danger)" }}>
            The passwords don't match.
          </span>
        ) : null}
      </label>
      {m.error ? (
        <p className="small" style={{ color: "var(--danger)" }}>
          {errText(m.error)}
        </p>
      ) : null}
      {m.isSuccess ? (
        <p className="small" style={{ color: "var(--success)" }}>
          Password changed. You've been signed out on your other devices.
        </p>
      ) : null}
      <button
        type="submit"
        className="btn btn-primary btn-sm self-start"
        disabled={m.isPending || !current || !next || mismatch}
      >
        {m.isPending ? "Changing…" : "Change password"}
      </button>
    </form>
  );
}

/** Notification settings (D-052): in-app for now; always-on items are shown but locked. */
function NotificationSettings() {
  const q = useNotificationPreferences();
  const save = useSaveNotificationPreference();
  return (
    <section id="notifications" className="card rail-card flex flex-col gap-3">
      <b>Notifications</b>
      <p className="small muted" style={{ margin: 0 }}>
        Choose what appears under the bell. Text messages and emails your church sends aren&apos;t
        affected.
      </p>
      {q.isError ? <p className="small muted">{errText(q.error)}</p> : null}
      {q.data?.items.map((t) => {
        const ch = t.channels.find((c) => c.channel === "IN_APP");
        const id = `pref-${t.type}`;
        return (
          <label key={t.type} htmlFor={id} className="pref-row">
            <span>
              <span className="pref-label">{t.label}</span>
              <span className="small muted block">{t.hint}</span>
            </span>
            <input
              id={id}
              type="checkbox"
              role="switch"
              className="pref-switch"
              checked={ch?.enabled ?? true}
              disabled={!t.mutable || save.isPending}
              onChange={(e) =>
                save.mutate({ changes: [{ type: t.type, channel: "IN_APP", enabled: e.target.checked }] })
              }
            />
          </label>
        );
      })}
      {save.error ? (
        <p className="small" style={{ color: "var(--danger)" }}>
          {errText(save.error)}
        </p>
      ) : null}
    </section>
  );
}
