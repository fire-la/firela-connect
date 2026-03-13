import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config"

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.toml" },
      },
    },
    include: ["test/**/*.test.ts", "test/**/*.spec.ts"],
    exclude: ["node_modules", "dist"],
  },
})
