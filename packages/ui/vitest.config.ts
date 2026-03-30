/**
 * Vitest Configuration for BillClaw UI Package
 *
 * Testing setup with jsdom environment and React Testing Library.
 */
import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import path from "path"
import { existsSync, readFileSync } from "node:fs"

// Load test environment variables from .env.test (project root)
const envTestPath = path.resolve(import.meta.dirname, "../../.env.test")
if (existsSync(envTestPath)) {
  const envContent = readFileSync(envTestPath, "utf-8")
  envContent.split("\n").forEach((line) => {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...valueParts] = trimmed.split("=")
      if (key && valueParts.length > 0) {
        const value = valueParts.join("=").replace(/^["']|["']$/g, "")
        if (!process.env[key]) {
          process.env[key] = value
        }
      }
    }
  })
}

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    globals: true,
    pool: 'forks',
    setupFiles: ["./src/test/setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
