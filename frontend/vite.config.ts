// Vite config for MedFlow frontend development and builds.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// TS paths: ../tsconfig.json; Tailwind/PostCSS: ./tailwind.config.ts, ./postcss.config.js
export default defineConfig({
  server: {
    host: "::",
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_API_BASE_URL || "http://localhost:5000",
        changeOrigin: true,
      },
    },
    fs: {
      allow: ["./src", "index.html"],
      deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "server/**"],
    },
  },
  build: {
    outDir: "dist/spa",
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  css: {
    postcss: path.resolve(__dirname, "./postcss.config.js"),
  },
});
