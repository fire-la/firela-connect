/**
 * Shim for node:path module in Cloudflare Workers
 *
 * Simple path utilities that work in Workers environment.
 */

const normalizeArray = (parts: string[], allowAboveRoot: boolean): string[] => {
  const res: string[] = []
  for (const p of parts) {
    if (p && p !== ".") {
      if (p === "..") {
        if (res.length && res[res.length - 1] !== "..") {
          res.pop()
        } else if (allowAboveRoot) {
          res.push("..")
        }
      } else {
        res.push(p)
      }
    }
  }
  return res
}

const splitPath = (filename: string): string[] => {
  return filename.split("/").filter(Boolean)
}

export const resolve = (...paths: string[]): string => {
  let resolvedPath = ""
  let resolvedAbsolute = false

  for (let i = paths.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    let path = i >= 0 ? paths[i] : "/"
    if (!path) continue

    resolvedPath = path + "/" + resolvedPath
    resolvedAbsolute = path[0] === "/"
  }

  resolvedPath = normalizeArray(
    resolvedPath.split("/"),
    !resolvedAbsolute
  ).join("/")

  return (resolvedAbsolute ? "/" : "") + resolvedPath || "."
}

export const join = (...paths: string[]): string => {
  return normalizeArray(paths.flatMap(splitPath), false).join("/") || "."
}

export const dirname = (path: string): string => {
  const parts = path.split("/")
  parts.pop()
  return parts.join("/") || "."
}

export const basename = (path: string, ext?: string): string => {
  const base = path.split("/").pop() || ""
  if (ext && base.endsWith(ext)) {
    return base.slice(0, -ext.length)
  }
  return base
}

export const extname = (path: string): string => {
  const base = path.split("/").pop() || ""
  const dot = base.lastIndexOf(".")
  return dot > 0 ? base.slice(dot) : ""
}

export const normalize = (path: string): string => {
  const isAbsolute = path[0] === "/"
  const trailingSlash = path[path.length - 1] === "/"
  const parts = normalizeArray(splitPath(path), !isAbsolute)

  if (!parts.length && !isAbsolute) return "."
  if (!parts.length) return "/"

  return (isAbsolute ? "/" : "") + parts.join("/") + (trailingSlash ? "/" : "")
}

export const sep = "/"
export const delimiter = ":"

export default {
  resolve,
  join,
  dirname,
  basename,
  extname,
  normalize,
  sep,
  delimiter,
}
