/**
 * Telephone numbers (D-040). Stored as E.164 (+233241234567). People type them the local way,
 * so input is tidied first: spaces, dashes, dots and brackets go; "00…" becomes "+…"; a leading
 * "0" or a bare "233…" uses the default country (Ghana). Numbers already starting with "+" keep
 * their country, so other countries work unchanged.
 */
export const DEFAULT_COUNTRY_CODE = "233";
export const E164 = /^\+[1-9]\d{7,14}$/;
export const PHONE_HINT = "Use a number like 024 123 4567 or +233 24 123 4567";

/** Best-effort E.164; returns the tidied text unchanged if it can't tell (validation then explains). */
export function normalisePhone(input: string, countryCode: string = DEFAULT_COUNTRY_CODE): string {
  const raw = input.trim();
  if (!raw) return "";
  const plus = raw.startsWith("+");
  const digits = raw.replace(/[\s\-.()/]/g, "").replace(/^\+/, "");
  if (!/^\d+$/.test(digits)) return raw; // letters etc. — let validation reject it
  if (plus) return `+${digits}`;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  if (digits.startsWith(countryCode) && digits.length > countryCode.length + 7) return `+${digits}`;
  if (digits.startsWith("0") && digits.length > 7) return `+${countryCode}${digits.slice(1)}`;
  return digits;
}

export const isPhone = (input: string) => E164.test(normalisePhone(input));

/** "+233241234567" → "+233 24 123 4567" for display (other countries: grouped by 3s). */
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  const m = /^\+233(\d{2})(\d{3})(\d{4})$/.exec(e164);
  if (m) return `+233 ${m[1]} ${m[2]} ${m[3]}`;
  return e164;
}
