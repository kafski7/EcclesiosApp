import { CAlert, CButton, CForm, CFormInput, CFormLabel, CFormText } from "@coreui/react";
import { PasswordSchema, type AccountKind, type LoginChallengeResponse } from "@ecclesios/shared";
import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Brand } from "@/components/brand";
import { homeOf } from "@/components/require-auth";
import { ApiClientError } from "@/lib/api";
import { authErrorMessage, restartsSignIn } from "@/lib/auth-errors";
import { setFirstPassword, startSignIn, verifyCode } from "@/lib/auth";
import { env } from "@/lib/env";
import { useSession } from "@/stores/session";

type Step =
  | { kind: "credentials" }
  | { kind: "otp"; challenge: LoginChallengeResponse; identifier: string; password: string }
  | { kind: "set-password"; tempToken: string };

const asApiError = (e: unknown) => (e instanceof ApiClientError ? e : null);

const COPY: Record<AccountKind, { sub: string; title: string; lede: string }> = {
  member: {
    sub: "Church Management",
    title: "Sign in to Church Management",
    lede: "For church staff: Administrators, Managers and Society-Leaders. Use your Ecclesios account.",
  },
  user: {
    sub: "Platform console",
    title: "Platform sign-in",
    lede: "For Ecclesios platform administrators.",
  },
};

/** Password → 6-digit code → (first time) set password — functionality §2.1 (users) / §2.2 (members). */
export function LoginPage({ kind }: { kind: AccountKind }) {
  const principal = useSession((s) => s.principal);
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from;
  const [step, setStep] = useState<Step>({ kind: "credentials" });
  const [notice, setNotice] = useState<string | null>(null);
  const copy = COPY[kind];

  if (principal && step.kind === "credentials")
    return <Navigate to={homeOf(principal.kind)} replace />;

  const done = () =>
    navigate(from && from.startsWith(homeOf(kind)) ? from : homeOf(kind), { replace: true });
  const restart = (message: string) => {
    setNotice(message || null);
    setStep({ kind: "credentials" });
  };

  return (
    <main className="cms-auth">
      <div className="card cms-auth-card">
        <Brand sub={copy.sub} dark={false} />
        {step.kind === "credentials" && (
          <Credentials
            kind={kind}
            title={copy.title}
            lede={copy.lede}
            notice={notice}
            onChallenge={(challenge, identifier, password) => {
              setNotice(null);
              setStep({ kind: "otp", challenge, identifier, password });
            }}
          />
        )}
        {step.kind === "otp" && (
          <Otp
            kind={kind}
            step={step}
            onDone={(r) =>
              r.status === "AUTHENTICATED"
                ? done()
                : setStep({ kind: "set-password", tempToken: r.tempToken })
            }
            onRestart={restart}
            onResent={(challenge) => setStep({ ...step, challenge })}
          />
        )}
        {step.kind === "set-password" && (
          <SetPassword tempToken={step.tempToken} onDone={done} onRestart={restart} />
        )}

        <p className="cms-auth-switch">
          {kind === "member" ? (
            <>
              Ecclesios staff? <Link to="/admin-login">Platform sign-in</Link> ·{" "}
              <a href={env.VITE_WEB_URL}>Back to Ecclesios</a>
            </>
          ) : (
            <>
              Church staff? <Link to="/login">Church Management sign-in</Link>
            </>
          )}
        </p>
      </div>
    </main>
  );
}

function Credentials(props: {
  kind: AccountKind;
  title: string;
  lede: string;
  notice: string | null;
  onChallenge: (c: LoginChallengeResponse, identifier: string, password: string) => void;
}) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const m = useMutation({
    mutationFn: () => startSignIn(props.kind, identifier.trim(), password),
    onSuccess: (c) => props.onChallenge(c, identifier.trim(), password),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (identifier.trim() && password) m.mutate();
  };
  return (
    <>
      <h1>{props.title}</h1>
      <p className="lede">{props.lede}</p>
      {props.notice ? <CAlert color="warning">{props.notice}</CAlert> : null}
      {m.error ? <CAlert color="danger">{authErrorMessage(asApiError(m.error))}</CAlert> : null}
      <CForm onSubmit={submit} noValidate>
        <div className="mb-3">
          <CFormLabel htmlFor="identifier">Email or phone number</CFormLabel>
          <CFormInput
            id="identifier"
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            autoFocus
          />
          <CFormText>Phone numbers start with the country code, e.g. +233…</CFormText>
        </div>
        <div className="mb-4">
          <CFormLabel htmlFor="password">Password</CFormLabel>
          <CFormInput
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <CButton
          type="submit"
          color="primary"
          className="btn-block"
          disabled={m.isPending || !identifier.trim() || !password}
        >
          {m.isPending ? "Checking…" : "Next"}
        </CButton>
      </CForm>
    </>
  );
}

function Otp(props: {
  kind: AccountKind;
  step: Extract<Step, { kind: "otp" }>;
  onDone: (r: Awaited<ReturnType<typeof verifyCode>>) => void;
  onRestart: (message: string) => void;
  onResent: (c: LoginChallengeResponse) => void;
}) {
  const [code, setCode] = useState("");
  const verify = useMutation({
    mutationFn: () => verifyCode(props.step.challenge.challengeToken, code),
    onSuccess: props.onDone,
    onError: (e) => {
      const err = asApiError(e);
      if (restartsSignIn(err?.code)) props.onRestart(authErrorMessage(err));
      setCode("");
    },
  });
  const resend = useMutation({
    mutationFn: () => startSignIn(props.kind, props.step.identifier, props.step.password),
    onSuccess: props.onResent,
  });
  const where =
    props.step.challenge.delivery.channel === "console"
      ? "Development mode: the code is printed in the API log."
      : `We sent it to ${props.step.challenge.delivery.destination}.`;
  return (
    <>
      <h1>Enter your code</h1>
      <p className="lede">Enter the 6-digit code. {where}</p>
      {verify.error && !restartsSignIn(asApiError(verify.error)?.code) ? (
        <CAlert color="danger">{authErrorMessage(asApiError(verify.error))}</CAlert>
      ) : null}
      {resend.isSuccess ? <CAlert color="success">A new code is on its way.</CAlert> : null}
      <CForm
        onSubmit={(e) => {
          e.preventDefault();
          if (/^\d{6}$/.test(code)) verify.mutate();
        }}
        noValidate
      >
        <CFormInput
          className="otp-input mb-4"
          aria-label="Verification code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          autoFocus
        />
        <CButton
          type="submit"
          color="primary"
          className="btn-block"
          disabled={verify.isPending || code.length !== 6}
        >
          {verify.isPending ? "Verifying…" : "Verify"}
        </CButton>
      </CForm>
      <div className="d-flex justify-content-between mt-3 small">
        <button
          type="button"
          className="link"
          onClick={() => resend.mutate()}
          disabled={resend.isPending}
        >
          Send a new code
        </button>
        <button type="button" className="link" onClick={() => props.onRestart("")}>
          Use a different account
        </button>
      </div>
    </>
  );
}

function SetPassword(props: {
  tempToken: string;
  onDone: () => void;
  onRestart: (m: string) => void;
}) {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const policy = PasswordSchema.safeParse(pw);
  const m = useMutation({
    mutationFn: () => setFirstPassword(props.tempToken, pw),
    onSuccess: props.onDone,
    onError: (e) => {
      const err = asApiError(e);
      if (restartsSignIn(err?.code)) props.onRestart(authErrorMessage(err));
    },
  });
  return (
    <>
      <h1>Choose your password</h1>
      <p className="lede">This is your first sign-in. Set a password you'll use from now on.</p>
      {m.error && !restartsSignIn(asApiError(m.error)?.code) ? (
        <CAlert color="danger">{authErrorMessage(asApiError(m.error))}</CAlert>
      ) : null}
      <CForm
        onSubmit={(e) => {
          e.preventDefault();
          if (policy.success && pw === confirm) m.mutate();
        }}
        noValidate
      >
        <div className="mb-3">
          <CFormLabel htmlFor="pw">New password</CFormLabel>
          <CFormInput
            id="pw"
            type="password"
            autoComplete="new-password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            invalid={!!pw && !policy.success}
            autoFocus
          />
          <CFormText>
            {pw && !policy.success
              ? policy.error.issues[0]?.message
              : "At least 10 characters, with a letter and a number"}
          </CFormText>
        </div>
        <div className="mb-4">
          <CFormLabel htmlFor="pw2">Confirm password</CFormLabel>
          <CFormInput
            id="pw2"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            invalid={!!confirm && pw !== confirm}
          />
        </div>
        <CButton
          type="submit"
          color="primary"
          className="btn-block"
          disabled={m.isPending || !policy.success || pw !== confirm}
        >
          {m.isPending ? "Saving…" : "Save and continue"}
        </CButton>
      </CForm>
    </>
  );
}
