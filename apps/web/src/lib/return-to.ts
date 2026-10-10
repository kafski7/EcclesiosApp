/**
 * "Bring me back here after signing in" (docs/social.md §10.3, D-043).
 * `?next=` only ever holds an in-app path; anything else falls back to Home, so the
 * sign-in page can't be used to bounce people to another site (open redirect).
 */

const AUTH_PAGES = ["/login", "/register"];

/** A same-site path such as "/hymnal/abide?x=1#v2", or "/" when `raw` is missing or unsafe. */
export function safeNext(raw: string | null | undefined): string {
  if (!raw || raw.length > 512) return "/";
  // Must be a single-slash absolute path: rejects "//evil.com", "/\\evil.com", "https:", "javascript:".
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  // Control characters (incl. tab/newline, which browsers strip) and backslashes anywhere.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\\]/.test(raw)) return "/";
  let url: URL;
  try {
    url = new URL(raw, "https://ecclesios.invalid");
  } catch {
    return "/";
  }
  if (url.origin !== "https://ecclesios.invalid") return "/";
  // Never send someone back to a sign-in page (loops).
  if (AUTH_PAGES.includes(url.pathname)) return "/";
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Path of the current page as a `next` value; empty on Home and on the auth pages themselves. */
export function currentAsNext(loc: { pathname: string; search?: string; hash?: string }): string {
  if (AUTH_PAGES.includes(loc.pathname)) return "";
  const here = `${loc.pathname}${loc.search ?? ""}${loc.hash ?? ""}`;
  return here === "/" ? "" : safeNext(here) === "/" ? "" : here;
}

/** "/login" or "/login?next=…" (also used for "/register"). */
export function withNext(page: "/login" | "/register", next: string | null | undefined): string {
  const n = next ? safeNext(next) : "/";
  return n === "/" ? page : `${page}?next=${encodeURIComponent(n)}`;
}
