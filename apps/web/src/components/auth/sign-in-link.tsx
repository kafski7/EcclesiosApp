import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { currentAsNext, withNext } from "@/lib/return-to";

/** "/login?next=<this page>" — sign in and come straight back (D-043). */
export function useSignInHere(page: "/login" | "/register" = "/login"): string {
  const loc = useLocation();
  return withNext(page, currentAsNext(loc));
}

/** A Sign in (or Create account) link that returns to the current page afterwards. */
export function SignInLink({
  children = "Sign in",
  className = "link",
  page = "/login",
}: {
  children?: ReactNode;
  className?: string;
  page?: "/login" | "/register";
}) {
  const to = useSignInHere(page);
  return (
    <Link to={to} className={className}>
      {children}
    </Link>
  );
}
