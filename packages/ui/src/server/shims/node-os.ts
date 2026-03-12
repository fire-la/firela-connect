/**
 * Shim for node:os module in Cloudflare Workers
 *
 * Provides minimal implementations compatible with Workers environment.
 */

export const homedir = () => "/tmp"
export const tmpdir = () => "/tmp"
export const platform = () => "linux"
export const arch = () => "x64"
export const type = () => "Linux"
export const release = () => "1.0.0"
export const hostname = () => "workers"
export const cpus = () => [{ model: "", speed: 0, times: {} }]
export const freemem = () => 0
export const totalmem = () => 0
export const uptime = () => 0
export const loadavg = () => [0, 0, 0]
export const networkInterfaces = () => ({})

export const EOL = "\n"
export const constants = {
  signals: {},
  errno: {},
}

export default {
  homedir,
  tmpdir,
  platform,
  arch,
  type,
  release,
  hostname,
  cpus,
  freemem,
  totalmem,
  uptime,
  loadavg,
  networkInterfaces,
  EOL,
  constants,
}
