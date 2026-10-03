import { z } from "zod";

/** Browser config — public by design (docs/ops/secrets.md: no secrets in VITE_*). */
const EnvSchema = z.object({
  VITE_API_URL: z.string().url().default("http://localhost:4000/api"),
  /** Social platform URL, for "back to Ecclesios" links. */
  VITE_WEB_URL: z.string().url().default("http://localhost:5173"),
});

export const env = EnvSchema.parse(import.meta.env);
