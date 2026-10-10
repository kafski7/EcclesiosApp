import { RegisterRequestSchema, type ChurchOption, type RegisterResponse } from "@ecclesios/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, MapPin, Search } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { AuthLayout, Field, FormAlert } from "@/components/auth/auth-layout";
import { ApiClientError } from "@/lib/api";
import { authErrorMessage, fieldErrors } from "@/lib/auth-errors";
import { register, searchChurches } from "@/lib/auth";
import { safeNext, withNext } from "@/lib/return-to";
import { useSession } from "@/stores/session";

const EMPTY = {
  firstName: "",
  lastName: "",
  otherNames: "",
  email: "",
  telephone: "",
  gender: "" as "" | "MALE" | "FEMALE",
  dateOfBirth: "",
  password: "",
  confirm: "",
};

/**
 * Self-registration (functionality §2.4, D-014/D-015): pick your parish or outstation, fill in your
 * details, and sign in straight away. Church-only features unlock when the church approves you.
 */
export function RegisterPage() {
  const principal = useSession((s) => s.principal);
  const [params] = useSearchParams();
  const rawNext = params.get("next");
  const [parish, setParish] = useState<ChurchOption | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof typeof EMPTY) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const m = useMutation({
    mutationFn: () =>
      register({
        churchId: parish?.id ?? "",
        firstName: form.firstName,
        lastName: form.lastName,
        otherNames: form.otherNames,
        email: form.email,
        telephone: form.telephone,
        gender: form.gender || undefined,
        dateOfBirth: form.dateOfBirth,
        password: form.password,
      }),
    onError: (e) => {
      if (e instanceof ApiClientError && e.code === "VALIDATION_FAILED")
        setErrors(fieldErrors(e.details));
    },
  });

  if (principal) return <Navigate to={safeNext(rawNext)} replace />;
  if (m.data) return <Submitted result={m.data} next={rawNext} />;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const local: Record<string, string> = {};
    const parsed = RegisterRequestSchema.safeParse({
      ...form,
      churchId: parish?.id ?? "",
      gender: form.gender || undefined,
    });
    if (!parsed.success) Object.assign(local, fieldErrors(parsed.error.flatten()));
    if (form.password !== form.confirm) local.confirm = "The passwords don't match";
    setErrors(local);
    if (Object.keys(local).length === 0) m.mutate();
  };

  const apiError = m.error instanceof ApiClientError ? m.error : null;

  return (
    <AuthLayout>
      <h1 className="auth-x-sub">Join your church on Ecclesios</h1>
      <p className="auth-x-lede">
        Choose your parish or outstation and tell us who you are. You can start using Ecclesios
        right away; your church office will confirm your membership.
      </p>
      {apiError && apiError.code !== "VALIDATION_FAILED" ? (
        <FormAlert>
          {authErrorMessage(apiError)}
          {apiError.code === "CLAIM_ACCOUNT" ? (
            <>
              {" "}
              <Link to="/login?claim=1">Claim your account</Link>
            </>
          ) : null}
        </FormAlert>
      ) : null}

      <form className="auth-form" onSubmit={submit} noValidate>
        <ParishPicker value={parish} onChange={setParish} error={errors.churchId} />

        <div className="auth-grid-2">
          <Field label="First name" error={errors.firstName}>
            <input
              className="auth-input"
              autoComplete="given-name"
              value={form.firstName}
              onChange={(e) => set("firstName")(e.target.value)}
            />
          </Field>
          <Field label="Last name" error={errors.lastName}>
            <input
              className="auth-input"
              autoComplete="family-name"
              value={form.lastName}
              onChange={(e) => set("lastName")(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Other names (optional)" error={errors.otherNames}>
          <input
            className="auth-input"
            autoComplete="additional-name"
            value={form.otherNames}
            onChange={(e) => set("otherNames")(e.target.value)}
          />
        </Field>

        <Field
          label="Email"
          error={errors.email}
          hint="Email or phone — at least one, so you can sign in"
        >
          <input
            className="auth-input"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => set("email")(e.target.value)}
          />
        </Field>
        <Field
          label="Phone number"
          error={errors.telephone}
          hint="e.g. 024 123 4567 or +233 24 123 4567"
        >
          <input
            className="auth-input"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            value={form.telephone}
            onChange={(e) => set("telephone")(e.target.value)}
          />
        </Field>

        <div className="auth-grid-2">
          <Field label="Gender (optional)" error={errors.gender}>
            <select
              className="auth-input"
              value={form.gender}
              onChange={(e) => set("gender")(e.target.value)}
            >
              <option value="">—</option>
              <option value="FEMALE">Female</option>
              <option value="MALE">Male</option>
            </select>
          </Field>
          <Field label="Date of birth (optional)" error={errors.dateOfBirth}>
            <input
              className="auth-input"
              type="date"
              autoComplete="bday"
              value={form.dateOfBirth}
              onChange={(e) => set("dateOfBirth")(e.target.value)}
            />
          </Field>
        </div>

        <Field
          label="Password"
          error={errors.password}
          hint="At least 10 characters, with a letter and a number"
        >
          <input
            className="auth-input"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => set("password")(e.target.value)}
          />
        </Field>
        <Field label="Confirm password" error={errors.confirm}>
          <input
            className="auth-input"
            type="password"
            autoComplete="new-password"
            value={form.confirm}
            onChange={(e) => set("confirm")(e.target.value)}
          />
        </Field>

        <button type="submit" className="auth-btn auth-btn-primary" disabled={m.isPending}>
          {m.isPending ? "Creating account…" : "Create account"}
        </button>
        <p className="auth-x-legal">
          By joining you agree to our <Link to="/terms">Terms</Link> and{" "}
          <Link to="/privacy">Privacy Policy</Link>. Your church's administrators will see the
          details you give here.
        </p>
      </form>
      <p className="auth-x-switch">
        Already have an account? <Link to={withNext("/login", rawNext)}>Sign in</Link>
      </p>
    </AuthLayout>
  );
}

function ParishPicker({
  value,
  onChange,
  error,
}: {
  value: ChurchOption | null;
  onChange: (p: ChurchOption | null) => void;
  error?: string;
}) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);
  const results = useQuery({
    queryKey: ["parishes", debounced],
    queryFn: () => searchChurches(debounced),
    enabled: !value && debounced.length >= 2,
    staleTime: 5 * 60_000,
  });

  if (value) {
    return (
      <div className="auth-field">
        <span className="auth-field-label">Your church</span>
        <div className="parish-chosen">
          <Check className="ic" aria-hidden />
          <div>
            <b>{value.name}</b>
            <small>{churchContext(value)}</small>
          </div>
          <button type="button" className="auth-link" onClick={() => onChange(null)}>
            Change
          </button>
        </div>
      </div>
    );
  }

  const items = results.data?.items ?? [];
  return (
    <div className={`auth-field${error ? " has-error" : ""}`}>
      <label className="auth-field-label" htmlFor="parish-search">
        Your parish or outstation
      </label>
      <div className="parish-search">
        <Search className="ic" aria-hidden />
        <input
          id="parish-search"
          className="auth-input"
          placeholder="Start typing your church's name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-controls="parish-results"
          autoComplete="off"
        />
      </div>
      {debounced.length >= 2 ? (
        <ul id="parish-results" className="parish-results" role="listbox" aria-label="Churches">
          {results.isFetching && !items.length ? (
            <li className="parish-empty">Searching…</li>
          ) : null}
          {results.isError ? (
            <li className="parish-empty">{authErrorMessage(results.error as ApiClientError)}</li>
          ) : null}
          {!results.isFetching && results.isSuccess && !items.length ? (
            <li className="parish-empty">
              No church found. Check the spelling, or ask your church office if it's on Ecclesios
              yet.
            </li>
          ) : null}
          {items.map((p) => (
            <li key={p.id} role="option" aria-selected={false}>
              <button type="button" onClick={() => onChange(p)}>
                <MapPin className="ic" aria-hidden />
                <span>
                  <b>{p.name}</b>
                  <small>{churchContext(p)}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? (
        <span className="auth-field-error" role="alert">
          {error}
        </span>
      ) : (
        <span className="auth-field-hint">
          This becomes your home church. Its office confirms your membership; outstation requests
          can also be confirmed by the parish.
        </span>
      )}
    </div>
  );
}

function churchContext(c: ChurchOption) {
  const where =
    c.level === "OUTSTATION"
      ? [`Outstation of ${c.parish ?? "a parish"}`, c.diocese]
      : [c.deanery, c.diocese];
  return where.filter(Boolean).join(" · ");
}

function Submitted({ result, next }: { result: RegisterResponse; next: string | null }) {
  return (
    <AuthLayout>
      <h1 className="auth-x-sub">Welcome to Ecclesios</h1>
      <p className="auth-x-lede">
        Your account is ready — sign in now and start using Ecclesios.{" "}
        <b>{result.membership.church.name}</b> has been asked to confirm your membership;
        members-only features for that church (notices, dues, societies) open once they do.
      </p>
      <Link to={safeNext(next)} className="auth-btn auth-btn-outline">
        Continue to Ecclesios
      </Link>
      <Link to={withNext("/login", next)} className="auth-btn auth-btn-primary">
        Go to sign in
      </Link>
    </AuthLayout>
  );
}
