import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// blueprint §5 Mobile Strategy: installable PWA from day one.
// Offline caching of readings/Bible/hymns (IndexedDB) arrives with those modules (Phase 5, 9).
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "Ecclesios",
        short_name: "Ecclesios",
        description: "Readings, saints, hymns, Bible and your church community.",
        theme_color: "#5A0E17",
        background_color: "#FAF9F6",
        display: "standalone",
        start_url: "/",
        icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }],
      },
      workbox: {
        // App shell only. API responses are never cached here (auth + freshness).
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: { port: 5173 },
});
