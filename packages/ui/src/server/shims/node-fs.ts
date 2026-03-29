/**
 * Shim for node:fs module in Cloudflare Workers
 *
 * This shim provides stub implementations for file system operations.
 * In Workers, file system is virtual and per-request.
 * Use D1 or KV for persistent storage instead.
 */

// Re-export from the virtual fs provided by nodejs_compat_v2 if available
// Otherwise provide stubs that throw helpful errors

const notAvailable = (method: string) => {
  throw new Error(
    `node:fs.${method} is not available in Cloudflare Workers. ` +
    `Use D1 or KV for persistent storage, or enable nodejs_compat_v2 flag.`
  )
}

export const promises = {
  readFile: () => notAvailable("readFile"),
  writeFile: () => notAvailable("writeFile"),
  mkdir: () => notAvailable("mkdir"),
  readdir: () => notAvailable("readdir"),
  stat: () => notAvailable("stat"),
  unlink: () => notAvailable("unlink"),
  access: () => notAvailable("access"),
  chmod: () => notAvailable("chmod"),
  copyFile: () => notAvailable("copyFile"),
  rename: () => notAvailable("rename"),
  rmdir: () => notAvailable("rmdir"),
}

// Top-level exports for "node:fs/promises" (used by core dist imports)
// These are destructured imports like: import { readFile } from "node:fs/promises"
export const readFile = () => notAvailable("readFile")
export const writeFile = () => notAvailable("writeFile")
export const mkdir = () => notAvailable("mkdir")
export const readdir = () => notAvailable("readdir")
export const stat = () => notAvailable("stat")
export const unlink = () => notAvailable("unlink")
export const access = () => notAvailable("access")
export const chmod = () => notAvailable("chmod")
export const copyFile = () => notAvailable("copyFile")
export const rename = () => notAvailable("rename")
export const rmdir = () => notAvailable("rmdir")
export const appendFile = () => notAvailable("appendFile")

export const readFileSync = () => notAvailable("readFileSync")
export const writeFileSync = () => notAvailable("writeFileSync")
export const existsSync = () => false
export const mkdirSync = () => notAvailable("mkdirSync")
export const readdirSync = () => notAvailable("readdirSync")
export const statSync = () => notAvailable("statSync")
export const unlinkSync = () => notAvailable("unlinkSync")

export default {
  promises,
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
}
