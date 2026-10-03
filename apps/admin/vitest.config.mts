import { fileURLToPath, URL } from "node:url";
import { defineConfig, mergeConfig } from "vitest/config";
import base from "@ecclesios/config/vitest";

export default mergeConfig(
  base,
  defineConfig({
    resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
    test: { include: ["src/**/*.test.ts"], environment: "node" },
  }),
);
