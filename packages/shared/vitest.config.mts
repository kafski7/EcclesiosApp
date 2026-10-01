import { defineConfig, mergeConfig } from "vitest/config";
import base from "@ecclesios/config/vitest";

export default mergeConfig(base, defineConfig({ test: { include: ["src/**/*.test.ts"] } }));
