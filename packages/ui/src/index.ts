/**
 * @firela/billclaw-ui
 *
 * Unified UI package exports
 */

// Re-export the Hono app for use in CLI and other consumers
export { default as app, type Env, type AppType } from "./server/index.js"

// Re-export shadcn/ui components
export * from "./components/ui/index.js"
