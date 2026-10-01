/** Load packages/db/.env if present (CI passes env vars directly, so a missing file is fine). */
export function loadEnv() {
  try {
    process.loadEnvFile(".env");
  } catch {
    /* no .env — rely on the real environment */
  }
}
