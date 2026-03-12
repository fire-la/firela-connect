/**
 * Vite Configuration for BillClaw UI Package
 *
 * React + Vite + Hono setup for unified development and production.
 *
 * Development:
 * - Vite serves React SPA with HMR
 * - @hono/vite-dev-server provides API routes
 *
 * Production:
 * - Vite builds static assets
 * - Hono serves API + static files on Cloudflare Workers
 */
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import devServer from "@hono/vite-dev-server"
import path from "path"

export default defineConfig({
  plugins: [
    react(),
    // Hono dev server for API routes
    devServer({
      entry: "src/server/index.ts",
      injectClientScript: true,
      // Exclude static assets from Hono server
      exclude: [
        /^\/assets\/.+/,
        /^\/src\/.+$/,
        /\?html-proxy$/,
        /^\/@.+$/,
        /^\/node_modules\/.+$/,
      ],
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: parseInt(process.env.PORT || "5173", 10),
    // No proxy needed - Hono handles API routes directly
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
})
