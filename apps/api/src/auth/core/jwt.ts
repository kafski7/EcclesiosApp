import { createHmac } from "node:crypto";
import { safeEqual } from "./crypto";

/**
 * Minimal HS256 JWT (RFC 7519) — sign/verify only, algorithm pinned.
 * Kept in-house so the auth core has no framework dependency and is unit-testable;
 * the header `alg` is never trusted (no "none", no RS/HS confusion). See decision D-006.
 */
export interface JwtOptions {
  issuer: string;
  audience: string;
}

export class JwtError extends Error {
  constructor(readonly reason: "malformed" | "signature" | "expired" | "claims") {
    super(`JWT ${reason}`);
  }
}

const HEADER = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");

const sign = (data: string, secret: string) =>
  createHmac("sha256", secret).update(data).digest("base64url");

export function signJwt(
  claims: Record<string, unknown>,
  secret: string,
  ttlSec: number,
  opts: JwtOptions,
  now = new Date(),
): string {
  const iat = Math.floor(now.getTime() / 1000);
  const payload = { ...claims, iss: opts.issuer, aud: opts.audience, iat, exp: iat + ttlSec };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${HEADER}.${body}.${sign(`${HEADER}.${body}`, secret)}`;
}

export function verifyJwt<T = Record<string, unknown>>(
  token: string,
  secret: string,
  opts: JwtOptions,
  now = new Date(),
): T & { iat: number; exp: number } {
  const parts = token.split(".");
  if (parts.length !== 3) throw new JwtError("malformed");
  const [h, b, s] = parts as [string, string, string];
  if (h !== HEADER) throw new JwtError("malformed"); // pins alg=HS256, typ=JWT
  if (!safeEqual(s, sign(`${h}.${b}`, secret))) throw new JwtError("signature");
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(Buffer.from(b, "base64url").toString("utf8"));
  } catch {
    throw new JwtError("malformed");
  }
  const t = Math.floor(now.getTime() / 1000);
  if (typeof payload.exp !== "number" || payload.exp <= t) throw new JwtError("expired");
  if (payload.iss !== opts.issuer || payload.aud !== opts.audience) throw new JwtError("claims");
  return payload as T & { iat: number; exp: number };
}
