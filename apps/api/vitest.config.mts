import { defineConfig, mergeConfig } from "vitest/config";
import swc from "unplugin-swc";
import base from "@ecclesios/config/vitest";

// SWC (not esbuild) so NestJS decorator metadata is emitted.
export default mergeConfig(
  base,
  defineConfig({
    plugins: [swc.vite({ module: { type: "es6" } })],
    test: { include: ["src/**/*.spec.ts"] },
  }),
);
