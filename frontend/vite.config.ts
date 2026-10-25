import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// Vite dijalankan dari root repo, jadi root aplikasi diarahkan ke folder ini.
export default defineConfig({
  root: __dirname,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  // API dijalankan terpisah (`npm run dev:worker` di :8787); tanpa proxy,
  // fetch("/api/...") dari :5173 kena fallback SPA dan balik HTML.
  server: {
    proxy: { "/api": { target: "http://127.0.0.1:8787", changeOrigin: false } },
  },
});
