// e2e defaults — real env vars (e.g. in CI) win. Requires `pnpm db:setup` first.
const defaults: Record<string, string> = {
  NODE_ENV: "test",
  LOG_LEVEL: "warn",
  DATABASE_URL: "postgres://ecclesios:ecclesios@localhost:5432/ecclesios",
  JWT_ACCESS_SECRET: "e2e-access-secret-0123456789abcdef",
  JWT_REFRESH_SECRET: "e2e-refresh-secret-0123456789abcdef",
  AUTH_RATE_IP_MAX: "1000",
  AUTH_RATE_IDENTIFIER_MAX: "5",
};
try {
  process.loadEnvFile(".env");
} catch {
  /* optional */
}
for (const [k, v] of Object.entries(defaults)) process.env[k] ??= v;
process.env.NODE_ENV = "test";
process.env.AUTH_RATE_IP_MAX = "1000"; // keep the per-IP bucket out of the way; identifier limit is tested
// Phase 7 (D-050): jobs run inline in the test process — no Redis needed, results visible at once.
process.env.QUEUE_DRIVER = "inline";
process.env.SMS_PROVIDER = "console";
process.env.EMAIL_PROVIDER = "console";
process.env.BIRTHDAY_DIGEST_CRON = "";
