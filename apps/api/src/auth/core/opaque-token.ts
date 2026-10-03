import type { AccountKind } from "@ecclesios/shared";

/**
 * Opaque tokens for temp (password setup) and refresh: "<prefix>.<kind>.<accountId>.<secret>".
 * The id lets us find the row; only an HMAC of the secret is stored, so a DB leak can't mint sessions.
 */
export type OpaquePrefix = "tmp1" | "rft1";

export const formatOpaque = (prefix: OpaquePrefix, kind: AccountKind, id: string, secret: string) =>
  `${prefix}.${kind}.${id}.${secret}`;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseOpaque(
  token: string,
  prefix: OpaquePrefix,
): { kind: AccountKind; id: string; secret: string } | null {
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [p, kind, id, secret] = parts as [string, string, string, string];
  if (
    p !== prefix ||
    (kind !== "member" && kind !== "user") ||
    !UUID.test(id) ||
    secret.length < 20
  )
    return null;
  return { kind, id, secret };
}
