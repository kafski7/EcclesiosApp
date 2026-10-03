import { PasswordSchema, type LoginChallengeResponse } from "@ecclesios/shared";
import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { AuthLayout, Field, FormAlert } from "@/components/auth/auth-layout";
import { ApiClientError } from "@/lib/api";
import { authErrorMessage, restartsSignIn } from "@/lib/auth-errors";
import { setFirstPassword, startSignIn, verifyCode } from "@/lib/auth";
import { useSession } from "@/stores/session";

type Step =
  | { kind: "credentials" }
  | { kind: "otp"; challenge: LoginChallengeResponse; identifier: string; password: string }
  | { kind: "set-password"; tempToken: string };

const asApiError = (e: unknown) => (e instanceof ApiClientError ? e : null);

/** Member sign-in (functionality §2.2): password → 6-digit code → (first time) set password. */
export function LoginPage() {
  const principal = useSession((s) => s.principal);
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>({ kind: "credentials" });
  const [notice, setNotice] = useState<string | null>(null);

  if (principal && step.kind === "credentials") return <Navigate to="/" replace />;

  const done = () => navigate("/", { replace: true });
  const restart = (message: string) => {
    setNotice(message);
    setStep({ kind: "credentials" });
  };

  return (
    <AuthLayout>
      {step.kind === "credentials" && (
        <CredentialsStep
          notice={notice}
          onChallenge={(challenge, identifier, password) => {
            setNotice(null);
            setStep({ kind: "otp", challenge, identifier, password });
          }}
        />
      )}
      {step.kind === "otp" && (
        <OtpStep
          step={step}
          onAuthenticated={done}
          onSetPassword={(tempToken) => setStep({ kind: "set-password", tempToken })}
          onRestart={restart}
          onResent={(challenge) => setStep({ ...step, challenge })}
        />
      )}
      {step.kind === "set-password" && (
        <SetPasswordStep tempToken={step.tempToken} onDone={done} onRestart={restart} />
      )}
    </AuthLayout>
  );
}

function CredentialsStep({
  notice,
  onChallenge,
}: {
  notice: string | null;
  onChallenge: (c: LoginChallengeResponse, identifier: string, password: string) => void;
}) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const m = useMutation({
    mutationFn: () => startSignIn(identifier.trim(), password),
    onSuccess: (c) => onChallenge(c, identifier.trim(), password),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (identifier.trim() && password) m.mutate();
  };

  return (
    <>
      <h1 className="auth-x-title">Faith, together.</h1>
      <h2 className="auth-x-sub">Sign in to Ecclesios</h2>
      {notice ? <FormAlert>{notice}</FormAlert> : null}
      {m.error ? <FormAlert>{authErrorMessage(asApiError(m.error))}</FormAlert> : null}
      <form className="auth-form" onSubmit={submit} noValidate>
        <Field
          label="Email or phone number"
          hint="Phone numbers start with your country code, e.g. +233…"
        >
          <input
            className="auth-input"
            autoComplete="username"
            inputMode="email"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
            autoFocus
          />
        </Field>
        <Field label="Password">
          <input
            className="auth-input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        <button
          type="submit"
          className="auth-btn auth-btn-primary"
          disabled={m.isPending || !identifier.trim() || !password}
        >
          {m.isPending ? "Checking…" : "Next"}
        </button>
      </form>
      <p className="auth-x-switch">
        New to Ecclesios? <Link to="/register">Create an account</Link>
      </p>
      <p className="auth-x-switch">
        Church staff? <Link to="/cms-login">Church Management login</Link>
      </p>
    </>
  );
}

function OtpStep({
  step,
  onAuthenticated,
  onSetPassword,
  onRestart,
  onResent,
}: {
  step: Extract<Step, { kind: "otp" }>;
  onAuthenticated: () => void;
  onSetPassword: (tempToken: string) => void;
  onRestart: (message: string) => void;
  onResent: (c: LoginChallengeResponse) => void;
}) {
  const [code, setCode] = useState("");
  const verify = useMutation({
    mutationFn: () => verifyCode(step.challenge.challengeToken, code),
    onSuccess: (res) =>
      res.status === "AUTHENTICATED" ? onAuthenticated() : onSetPassword(res.tempToken),
    onError: (e) => {
      const err = asApiError(e);
      if (restartsSignIn(err?.code)) onRestart(authErrorMessage(err));
      setCode("");
    },
  });
  const resend = useMutation({
    mutationFn: () => startSignIn(step.identifier, step.password),
    onSuccess: onResent,
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (/^\d{6}$/.test(code)) verify.mutate();
  };
  const where =
    step.challenge.delivery.channel === "console"
      ? "Development mode: the code is printed in the API log."
      : `We sent it to ${step.challenge.delivery.destination}.`;

  return (
    <>
      <h1 className="auth-x-sub">Enter your code</h1>
      <p className="auth-x-lede">
        Enter the 6-digit code. {where} It expires in{" "}
        {Math.round(step.challenge.expiresInSeconds / 60)} minutes.
      </p>
      {verify.error && !restartsSignIn(asApiError(verify.error)?.code) ? (
        <FormAlert>{authErrorMessage(asApiError(verify.error))}</FormAlert>
      ) : null}
      {resend.isSuccess ? <p className="auth-x-ok">A new code is on its way.</p> : null}
      <form className="auth-form" onSubmit={submit} noValidate>
        <Field label="Verification code">
          <input
            className="auth-input auth-input-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            autoFocus
          />
        </Field>
        <button
          type="submit"
          className="auth-btn auth-btn-primary"
          disabled={verify.isPending || code.length !== 6}
        >
          {verify.isPending ? "Verifying…" : "Verify"}
        </button>
      </form>
      <div className="auth-x-row">
        <button
          type="button"
          className="auth-link"
          onClick={() => resend.mutate()}
          disabled={resend.isPending}
        >
          Send a new code
        </button>
        <button type="button" className="auth-link" onClick={() => onRestart("")}>
          Use a different account
        </button>
      </div>
    </>
  );
}

function SetPasswordStep({
  tempToken,
  onDone,
  onRestart,
}: {
  tempToken: string;
  onDone: () => void;
  onRestart: (message: string) => void;
}) {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const policy = PasswordSchema.safeParse(pw);
  const policyError = pw && !policy.success ? policy.error.issues[0]?.message : undefined;
  const mismatch = confirm && pw !== confirm ? "The passwords don't match" : undefined;
  const m = useMutation({
    mutationFn: () => setFirstPassword(tempToken, pw),
    onSuccess: onDone,
    onError: (e) => {
      const err = asApiError(e);
      if (restartsSignIn(err?.code)) onRestart(authErrorMessage(err));
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (policy.success && pw === confirm) m.mutate();
  };

  return (
    <>
      <h1 className="auth-x-sub">Choose your password</h1>
      <p className="auth-x-lede">
        This is your first sign-in. Set a password you'll use from now on.
      </p>
      {m.error && !restartsSignIn(asApiError(m.error)?.code) ? (
        <FormAlert>{authErrorMessage(asApiError(m.error))}</FormAlert>
      ) : null}
      <form className="auth-form" onSubmit={submit} noValidate>
        <Field
          label="New password"
          error={policyError}
          hint="At least 10 characters, with a letter and a number"
        >
          <input
            className="auth-input"
            type="password"
            autoComplete="new-password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoFocus
          />
        </Field>
        <Field label="Confirm password" error={mismatch}>
          <input
            className="auth-input"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Field>
        <button
          type="submit"
          className="auth-btn auth-btn-primary"
          disabled={m.isPending || !policy.success || pw !== confirm}
        >
          {m.isPending ? "Saving…" : "Save and continue"}
        </button>
      </form>
    </>
  );
}
