import { defineConfig } from "drizzle-kit";

try {
  process.loadEnvFile(".env");
} catch {
  /* CI passes DATABASE_URL directly */
}

// Workflow (blueprint §7): edit src/schema → `pnpm db:generate` → review SQL in ./drizzle → commit → `pnpm db:migrate`.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://ecclesios:ecclesios@localhost:5432/ecclesios",
  },
  strict: true,
  verbose: true,
});
