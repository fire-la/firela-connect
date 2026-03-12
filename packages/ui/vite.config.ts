/**
 * Vite Configuration for BillClaw UI Package
 *
 * React + Vite setup with API proxy for development.
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
  server: {
    port: parseInt(process.env.PORT || '5173', 10),
    proxy: {
      "/api": {
        target: "http://localhost:4456",
        changeOrigin: true,
      },
      "/oauth": {
        target: "http://localhost:4456",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
})
