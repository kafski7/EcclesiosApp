// Shared Vitest defaults. Usage in a package's vitest.config.mts:
//   import { defineConfig, mergeConfig } from "vitest/config";
//   import base from "@ecclesios/config/vitest";
//   export default mergeConfig(base, defineConfig({ /* overrides */ }));
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    passWithNoTests: true,
    coverage: { provider: "v8", reporter: ["text", "lcov"] },
  },
});
