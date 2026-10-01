import { z } from "zod";
import { parseDuration } from "../auth/core/crypto";

const bool = z
  .enum(["0", "1", "true", "false"])
  .default("0")
  .transform((v) => v === "1" || v === "true");

const secret = z.string().min(16, "must be at least 16 characters");

/** docs/ops/secrets.md: the API refuses to start if required env is missing or unsafe. */
export const EnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
    DATABASE_URL: z.string().url(),
    JWT_ACCESS_SECRET: secret,
    JWT_REFRESH_SECRET: secret,
    JWT_ACCESS_TTL: z.string().default("15m").transform(parseDuration),
    JWT_REFRESH_TTL: z.string().default("30d").transform(parseDuration),
    OTP_TTL_MINUTES: z.coerce.number().int().min(1).max(30).default(10),
    AUTH_RATE_IP_MAX: z.coerce.number().int().min(1).default(30),
    AUTH_RATE_IDENTIFIER_MAX: z.coerce.number().int().min(1).default(5),
    TRUST_PROXY: bool,
    CORS_ORIGINS: z
      .string()
      .default("")
      .transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean)),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== "production") return;
    for (const key of ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"] as const) {
      const v = env[key];
      if (v.length < 32 || v.startsWith("change-me"))
        ctx.addIssue({ code: "custom", path: [key], message: "production secrets must be ≥32 random characters" });
    }
    if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET)
      ctx.addIssue({ code: "custom", path: ["JWT_REFRESH_SECRET"], message: "must differ from JWT_ACCESS_SECRET" });
  });

export type Env = z.infer<typeof EnvSchema>;
export const ENV = Symbol("ENV");

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment for @ecclesios/api:\n${lines}\n(see apps/api/.env.example)`);
  }
  return parsed.data;
}

/** Loads apps/api/.env when present; real environment variables always win. */
export function loadDotEnv() {
  try {
    process.loadEnvFile(".env");
  } catch {
    /* no .env file — CI / production inject variables directly */
  }
}
