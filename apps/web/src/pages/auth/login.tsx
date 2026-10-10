import { PasswordSchema, type LoginChallengeResponse } from "@ecclesios/shared";
import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { AuthLayout, Field, FormAlert } from "@/components/auth/auth-layout";
import { ApiClientError } from "@/lib/api";
import { authErrorMessage, restartsSignIn } from "@/lib/auth-errors";
import { setFirstPassword, startClaim, startSignIn, verifyCode } from "@/lib/auth";
import { env } from "@/lib/env";
import { safeNext, withNext } from "@/lib/return-to";
import { useSession } from "@/stores/session";

type Step =
  | { kind: "credentials" }
  | { kind: "claim" }
  | {
      kind: "otp";
      challenge: LoginChallengeResponse;
      identifier: string;
      password: string;
      claim?: boolean;
    }
  | { kind: "set-password"; tempToken: string };

const asApiError = (e: unknown) => (e instanceof ApiClientError ? e : null);

/** Member sign-in (functionality §2.2): password → 6-digit code → (first time) set password. */
export function LoginPage() {
  const principal = useSession((s) => s.principal);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [step, setStep] = useState<Step>(
    params.get("claim") === "1" ? { kind: "claim" } : { kind: "credentials" },
  );
  const [notice, setNotice] = useState<string | null>(null);

  // Back to where the person was (D-043); only in-app paths are accepted.
  const next = safeNext(params.get("next"));
  if (principal && (step.kind === "credentials" || step.kind === "claim"))
    return <Navigate to={next} replace />;

  const done = () => navigate(next, { replace: true });
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
          onClaim={() => (setNotice(null), setStep({ kind: "claim" }))}
        />
      )}
      {step.kind === "claim" && (
        <ClaimStep
          onChallenge={(challenge, identifier) =>
            setStep({ kind: "otp", challenge, identifier, password: "", claim: true })
          }
          onBack={() => setStep({ kind: "credentials" })}
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
  onClaim,
}: {
  notice: string | null;
  onChallenge: (c: LoginChallengeResponse, identifier: string, password: string) => void;
  onClaim: () => void;
}) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  // Keep "come back to this page" when switching to Create account (D-043).
  const [params] = useSearchParams();
  const next = params.get("next");
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
        <Field label="Email or phone number" hint="e.g. you@example.com or 024 123 4567">
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
        New to Ecclesios? <Link to={withNext("/register", next)}>Create an account</Link>
      </p>
      <p className="auth-x-switch">
        Added by your church but never signed in?{" "}
        <button type="button" className="auth-link" onClick={onClaim}>
          Claim your account
        </button>
      </p>
      <p className="auth-x-switch">
        Church staff? <a href={`${env.VITE_ADMIN_URL}/login`}>Church Management login</a>
      </p>
    </>
  );
}

/** D-039: people their church added (no password yet) prove their phone or email, then set a password. */
function ClaimStep({
  onChallenge,
  onBack,
}: {
  onChallenge: (c: LoginChallengeResponse, identifier: string) => void;
  onBack: () => void;
}) {
  const [identifier, setIdentifier] = useState("");
  const m = useMutation({
    mutationFn: () => startClaim(identifier.trim()),
    onSuccess: (c) => onChallenge(c, identifier.trim()),
  });
  return (
    <>
      <h1 className="auth-x-sub">Claim your account</h1>
      <p className="auth-x-lede">
        If your parish or outstation added you to Ecclesios, enter the phone number or email they
        have for you. We'll send a code, then you choose a password.
      </p>
      {m.error ? <FormAlert>{authErrorMessage(asApiError(m.error))}</FormAlert> : null}
      <form
        className="auth-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (identifier.trim()) m.mutate();
        }}
        noValidate
      >
        <Field label="Email or phone number" hint="e.g. you@example.com or 024 123 4567">
          <input
            className="auth-input"
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
            autoFocus
          />
        </Field>
        <button
          type="submit"
          className="auth-btn auth-btn-primary"
          disabled={m.isPending || !identifier.trim()}
        >
          {m.isPending ? "Checking…" : "Send code"}
        </button>
      </form>
      <div className="auth-x-row">
        <button type="button" className="auth-link" onClick={onBack}>
          Back to sign in
        </button>
      </div>
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
    mutationFn: () =>
      step.claim ? startClaim(step.identifier) : startSignIn(step.identifier, step.password),
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
