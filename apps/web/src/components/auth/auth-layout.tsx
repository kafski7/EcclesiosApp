import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { BrandMark, SmallMark } from "./brand-mark";

/**
 * Full-page auth layout modelled on x.com's sign-in (D-013):
 * big brand mark filling the left half (hidden below 851px), form column on the right.
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-x">
      <div className="auth-x-art">
        <BrandMark className="auth-x-logo" />
      </div>
      <main className="auth-x-main" id="main">
        <div className="auth-x-col">
          <Link to="/" className="auth-x-home" aria-label="Back to Ecclesios">
            <SmallMark />
          </Link>
          {children}
        </div>
      </main>
      <footer className="auth-x-foot">
        <Link to="/about">About</Link>
        <Link to="/privacy">Privacy</Link>
        <Link to="/terms">Terms</Link>
        <span>© {new Date().getFullYear()} Ecclesios</span>
      </footer>
    </div>
  );
}

export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className={`auth-field${error ? " has-error" : ""}`}>
      <span className="auth-field-label">{label}</span>
      {children}
      {error ? (
        <span className="auth-field-error" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="auth-field-hint">{hint}</span>
      ) : null}
    </label>
  );
}

export function FormAlert({ children }: { children: ReactNode }) {
  return (
    <div className="auth-alert" role="alert">
      {children}
    </div>
  );
}
