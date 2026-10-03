import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

/** URL-safe random secret (default 32 bytes = 256 bits). */
export const randomToken = (bytes = 32): string => randomBytes(bytes).toString("base64url");

/** 6-digit numeric OTP from a CSPRNG (functionality §2). */
export const generateOtp = (): string => randomInt(0, 1_000_000).toString().padStart(6, "0");

/** Keyed hash for OTPs and opaque tokens. Secrets are never stored raw (schema _common.ts). */
export const hmac = (secret: string, ...parts: string[]): string =>
  createHmac("sha256", secret).update(parts.join("\u0000")).digest("hex");

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) {
    timingSafeEqual(ba, ba); // keep timing similar on length mismatch
    return false;
  }
  return timingSafeEqual(ba, bb);
}

/** "15m" / "30d" / "900s" / "12h" → seconds. */
export function parseDuration(value: string): number {
  const m = /^(\d+)\s*([smhd])$/.exec(value.trim());
  if (!m) throw new Error(`Invalid duration "${value}" — use e.g. 900s, 15m, 12h, 30d`);
  const n = Number(m[1]);
  const unit = { s: 1, m: 60, h: 3600, d: 86400 }[m[2] as "s" | "m" | "h" | "d"];
  return n * unit;
}

/** a***@example.org / +233*****4567 — for telling users where the code went. */
export function maskDestination(value: string): string {
  if (value.includes("@")) {
    const [local = "", domain = ""] = value.split("@");
    return `${local.slice(0, 1)}***@${domain}`;
  }
  return value.length > 8
    ? `${value.slice(0, 4)}${"*".repeat(value.length - 8)}${value.slice(-4)}`
    : "****";
}
