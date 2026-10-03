import { z } from "zod";

/** Browser config — public by design (docs/ops/secrets.md: no secrets in VITE_*). */
const EnvSchema = z.object({
  VITE_API_URL: z.string().url().default("http://localhost:4000/api"),
  VITE_APP_NAME: z.string().default("Ecclesios"),
  /** Church Management + platform console (apps/admin), a separate site (D-028). */
  VITE_ADMIN_URL: z.string().url().default("http://localhost:5174"),
});

export const env = EnvSchema.parse(import.meta.env);
