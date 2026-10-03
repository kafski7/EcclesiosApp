import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// CMS + platform console (blueprint §5). Browser-only, no PWA: staff tooling (blueprint §5 Mobile Strategy).
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: { port: 5174 },
});
