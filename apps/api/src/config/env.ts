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
    // Object storage (blueprint §5): MinIO in dev, R2/S3 in production. Binaries never pass through the API.
    S3_ENDPOINT: z.string().url().default("http://localhost:9000"),
    /** Endpoint the BROWSER uses for presigned URLs, if different (e.g. behind a CDN/proxy). */
    S3_PUBLIC_ENDPOINT: z.string().url().optional(),
    S3_REGION: z.string().default("us-east-1"),
    S3_ACCESS_KEY: z.string().default("ecclesios"),
    S3_SECRET_KEY: z.string().default("ecclesios-dev-secret"),
    S3_BUCKET: z.string().default("ecclesios-media"),
    S3_FORCE_PATH_STYLE: z
      .enum(["0", "1", "true", "false"])
      .default("1")
      .transform((v) => v === "1" || v === "true"),
    MEDIA_URL_TTL_SECONDS: z.coerce.number().int().min(30).max(3600).default(600),
    /**
     * Listener paywall for SUBSCRIBER media — hymnal items and podcast episodes (D-026, D-029).
     * Off until personal plans exist. HYMNAL_PAYWALL is the older name and still works.
     */
    LISTENER_PAYWALL: bool,
    HYMNAL_PAYWALL: bool,
    /**
     * Book payments (D-036). "test" = built-in test checkout (development and e2e only);
     * "hubtel" = Hubtel Online Checkout. Production must use hubtel.
     */
    PAYMENTS_GATEWAY: z.enum(["test", "hubtel"]).default("test"),
    HUBTEL_CLIENT_ID: z.string().optional(),
    HUBTEL_CLIENT_SECRET: z.string().optional(),
    /** Hubtel POS Sales / merchant account number. */
    HUBTEL_MERCHANT_ACCOUNT: z.string().optional(),
    /** Where buyers land after paying, and where Hubtel posts callbacks. */
    /**
     * Accounting link for collections (D-041). "dev" = built-in stand-in for the external accounting
     * service (development and e2e only); "none" = not connected (approved collections wait).
     */
    ACCOUNTING_PROVIDER: z.enum(["dev", "none"]).default("dev"),
    /**
     * Background jobs (Phase 7, D-050). "bullmq" = Redis queues with retries (dev and production);
     * "inline" = run each job straight away in the same process, once (tests only — never production).
     */
    REDIS_URL: z.string().url().default("redis://localhost:6379"),
    QUEUE_DRIVER: z.enum(["bullmq", "inline"]).default("bullmq"),
    /** Run the workers inside this process. 1 for `pnpm dev`; in production run `pnpm worker` separately and set 0. */
    WORKERS: z
      .enum(["0", "1", "true", "false"])
      .default("1")
      .transform((v) => v === "1" || v === "true"),
    WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(5),
    /** The church calendar day for daily jobs (birthday digest). */
    APP_TIMEZONE: z.string().default("Africa/Accra"),
    /** When the birthday digest runs (cron, APP_TIMEZONE). Empty = off. */
    BIRTHDAY_DIGEST_CRON: z.string().default("0 6 * * *"),
    /**
     * SMS gateway (D-050). "console" logs messages (codes included outside production);
     * "hubtel" = Hubtel SMS. Production must use a real gateway.
     */
    SMS_PROVIDER: z.enum(["console", "hubtel"]).default("console"),
    /** Approved sender ID (≤ 11 characters). */
    SMS_SENDER_ID: z.string().min(1).max(11).default("Ecclesios"),
    HUBTEL_SMS_CLIENT_ID: z.string().optional(),
    HUBTEL_SMS_CLIENT_SECRET: z.string().optional(),
    HUBTEL_SMS_URL: z.string().url().default("https://smsc.hubtel.com/v1/messages/send"),
    /** Email gateway (D-050). "console" logs; "smtp" sends through any SMTP server. */
    EMAIL_PROVIDER: z.enum(["console", "smtp"]).default("console"),
    EMAIL_FROM: z.string().default("Ecclesios <no-reply@ecclesios.app>"),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
    /** 1 = TLS from the start (port 465); 0 = STARTTLS. */
    SMTP_SECURE: bool,
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    PUBLIC_WEB_URL: z.string().url().default("http://localhost:5173"),
    PUBLIC_API_URL: z.string().url().default("http://localhost:4000"),
    CORS_ORIGINS: z
      .string()
      .default("")
      .transform((v) =>
        v
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      ),
  })
  .superRefine((env, ctx) => {
    if (env.PAYMENTS_GATEWAY === "hubtel")
      for (const key of [
        "HUBTEL_CLIENT_ID",
        "HUBTEL_CLIENT_SECRET",
        "HUBTEL_MERCHANT_ACCOUNT",
      ] as const)
        if (!env[key])
          ctx.addIssue({
            code: "custom",
            path: [key],
            message: "required when PAYMENTS_GATEWAY=hubtel",
          });
    if (env.SMS_PROVIDER === "hubtel")
      for (const key of ["HUBTEL_SMS_CLIENT_ID", "HUBTEL_SMS_CLIENT_SECRET"] as const)
        if (!env[key])
          ctx.addIssue({ code: "custom", path: [key], message: "required when SMS_PROVIDER=hubtel" });
    if (env.EMAIL_PROVIDER === "smtp" && !env.SMTP_HOST)
      ctx.addIssue({ code: "custom", path: ["SMTP_HOST"], message: "required when EMAIL_PROVIDER=smtp" });
    if (env.NODE_ENV !== "production") return;
    if (env.QUEUE_DRIVER === "inline")
      ctx.addIssue({
        code: "custom",
        path: ["QUEUE_DRIVER"],
        message: "inline jobs are for tests; production uses bullmq (Redis)",
      });
    if (env.SMS_PROVIDER === "console")
      ctx.addIssue({
        code: "custom",
        path: ["SMS_PROVIDER"],
        message: "production must send real SMS (hubtel) — OTPs depend on it",
      });
    if (env.EMAIL_PROVIDER === "console")
      ctx.addIssue({
        code: "custom",
        path: ["EMAIL_PROVIDER"],
        message: "production must send real email (smtp)",
      });
    if (env.ACCOUNTING_PROVIDER === "dev")
      ctx.addIssue({
        code: "custom",
        path: ["ACCOUNTING_PROVIDER"],
        message:
          "the dev accounting stand-in can't run in production (use none until a provider is chosen)",
      });
    if (env.PAYMENTS_GATEWAY !== "hubtel")
      ctx.addIssue({
        code: "custom",
        path: ["PAYMENTS_GATEWAY"],
        message: "production must take real payments (hubtel)",
      });
    for (const key of ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"] as const) {
      const v = env[key];
      if (v.length < 32 || v.startsWith("change-me"))
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: "production secrets must be ≥32 random characters",
        });
    }
    if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET)
      ctx.addIssue({
        code: "custom",
        path: ["JWT_REFRESH_SECRET"],
        message: "must differ from JWT_ACCESS_SECRET",
      });
  });

export type Env = z.infer<typeof EnvSchema>;
export const ENV = Symbol("ENV");

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const lines = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment for @ecclesios/api:\n${lines}\n(see apps/api/.env.example)`,
    );
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

/** One switch for every SUBSCRIBER item (D-029). */
export const listenerPaywall = (env: Pick<Env, "LISTENER_PAYWALL" | "HYMNAL_PAYWALL">) =>
  env.LISTENER_PAYWALL || env.HYMNAL_PAYWALL;
