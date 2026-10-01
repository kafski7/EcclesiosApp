import { defineConfig, mergeConfig } from "vitest/config";
import swc from "unplugin-swc";
import base from "@ecclesios/config/vitest";

// Needs a migrated + seeded Postgres (pnpm db:setup). See test/README.md.
export default mergeConfig(
  base,
  defineConfig({
    plugins: [swc.vite({ module: { type: "es6" } })],
    test: {
      include: ["test/**/*.e2e-spec.ts"],
      setupFiles: ["test/setup-env.ts"],
      fileParallelism: false,
      testTimeout: 30_000,
      hookTimeout: 60_000,
    },
  }),
);
