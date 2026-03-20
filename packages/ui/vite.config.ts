/**
 * Vite Configuration for BillClaw UI Package
 *
 * Vite is used only for building the React SPA.
 * Development server is handled by Wrangler (wrangler dev).
 * Production deployment is to Cloudflare Workers.
 */
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import path from "path"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: ["zod"],
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
})
