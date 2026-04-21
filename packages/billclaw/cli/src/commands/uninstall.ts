/**
 * Uninstall command
 *
 * Remove all Firela Connect Cloudflare resources (Workers, D1, KV).
 * For users who deployed via one-click Deploy Button.
 *
 * Steps: auth check -> discover resources -> confirm -> delete
 */

import type { CliCommand, CliContext } from "./registry.js"
import inquirer from "inquirer"
import chalk from "chalk"
import {
  verifyCloudflareAuth,
  parseWranglerToml,
  getPackagePath,
  type CloudflareResources,
} from "../utils/cloudflare.js"
import { Spinner } from "../utils/progress.js"
import { success, error, warn } from "../utils/format.js"
import * as fs from "node:fs/promises"

const CF_API_BASE = "https://api.cloudflare.com/client/v4"

/**
 * Make an authenticated Cloudflare API request
 *
 * @param path - API path (e.g., "/accounts")
 * @param method - HTTP method
 * @returns API response result
 * @throws Error on API failure
 */
async function cfApiFetch(path: string, method: string = "GET"): Promise<any> {
  const token = process.env.CLOUDFLARE_API_TOKEN

  if (!token) {
    throw new Error(
      "Cloudflare API token not found. Set CLOUDFLARE_API_TOKEN environment variable.",
    )
  }

  const response = await fetch(`${CF_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const body = (await response.json()) as {
    success: boolean
    result: any
    errors?: Array<{ message: string }>
  }

  if (!body.success) {
    const errorMsg = body.errors?.map((e) => e.message).join(", ") ?? `HTTP ${response.status}`
    throw new Error(`Cloudflare API error: ${errorMsg}`)
  }

  return body.result
}

/**
 * Get the first Cloudflare account ID
 *
 * @returns Account ID
 * @throws Error if no accounts found
 */
async function getAccountId(): Promise<string> {
  const accounts = await cfApiFetch("/accounts")
  if (!accounts || accounts.length === 0) {
    throw new Error("No Cloudflare accounts found")
  }
  return accounts[0].id
}

/**
 * Display all resources that will be deleted
 */
function displayResources(
  uiResources: CloudflareResources,
  botResources: CloudflareResources,
): void {
  console.log("")
  console.log(chalk.bold("The following resources will be permanently deleted:"))
  console.log("")

  console.log(chalk.cyan("Workers:"))
  console.log(`  - ${uiResources.workerName}`)
  console.log(`  - ${botResources.workerName}`)

  console.log("")
  console.log(chalk.cyan("D1 Databases:"))
  console.log(`  - ${uiResources.d1DatabaseName} (${uiResources.d1DatabaseId})`)
  console.log(`  - ${botResources.d1DatabaseName} (${botResources.d1DatabaseId})`)

  console.log("")
  console.log(chalk.cyan("KV Namespaces:"))
  console.log(`  - ${uiResources.kvBindingName} (${uiResources.kvNamespaceId})`)
  console.log(`  - ${botResources.kvBindingName} (${botResources.kvNamespaceId})`)

  console.log("")
}

/**
 * Delete all Cloudflare resources
 *
 * Deletes Workers first (no data), then D1 databases and KV namespaces.
 * Individual failures are reported but do not abort other deletions.
 */
async function deleteResources(
  accountId: string,
  uiResources: CloudflareResources,
  botResources: CloudflareResources,
): Promise<{ succeeded: number; failed: number }> {
  let succeeded = 0
  let failed = 0

  const deletions = [
    {
      type: "Worker",
      name: uiResources.workerName,
      path: `/accounts/${accountId}/workers/scripts/${uiResources.workerName}`,
    },
    {
      type: "Worker",
      name: botResources.workerName,
      path: `/accounts/${accountId}/workers/scripts/${botResources.workerName}`,
    },
    {
      type: "D1 Database",
      name: uiResources.d1DatabaseName,
      path: `/accounts/${accountId}/d1/database/${uiResources.d1DatabaseId}`,
    },
    {
      type: "D1 Database",
      name: botResources.d1DatabaseName,
      path: `/accounts/${accountId}/d1/database/${botResources.d1DatabaseId}`,
    },
    {
      type: "KV Namespace",
      name: uiResources.kvBindingName,
      path: `/accounts/${accountId}/storage/kv/namespaces/${uiResources.kvNamespaceId}`,
    },
    {
      type: "KV Namespace",
      name: botResources.kvBindingName,
      path: `/accounts/${accountId}/storage/kv/namespaces/${botResources.kvNamespaceId}`,
    },
  ]

  for (const item of deletions) {
    try {
      await Spinner.withLoading(
        `Deleting ${item.type}: ${item.name}...`,
        () => cfApiFetch(item.path, "DELETE"),
      )
      succeeded++
    } catch (err) {
      error(
        `Failed to delete ${item.type} "${item.name}": ${(err as Error).message}`,
      )
      failed++
    }
  }

  return { succeeded, failed }
}

/**
 * Run the uninstall process
 *
 * 1. Verify Cloudflare authentication
 * 2. Get account ID
 * 3. Parse both wrangler.toml files to enumerate resources
 * 4. Display resources to user
 * 5. Confirm deletion with user
 * 6. Delete all resources
 * 7. Print summary
 */
async function runUninstall(_context: CliContext): Promise<void> {
  // Step 1: Verify authentication
  await Spinner.withLoading(
    "Verifying Cloudflare authentication...",
    verifyCloudflareAuth,
  )

  // Step 2: Get account ID
  const accountId = await Spinner.withLoading(
    "Fetching Cloudflare account...",
    getAccountId,
  )

  // Step 3: Parse wrangler.toml files
  const uiTomlPath = getPackagePath("ui") + "/wrangler.toml"
  const botTomlPath = getPackagePath("firela-bot") + "/wrangler.toml"

  const [uiToml, botToml] = await Promise.all([
    fs.readFile(uiTomlPath, "utf-8"),
    fs.readFile(botTomlPath, "utf-8"),
  ])

  const uiResources = parseWranglerToml(uiToml)
  const botResources = parseWranglerToml(botToml)

  // Step 4: Display resources
  displayResources(uiResources, botResources)

  // Step 5: Confirm with user
  const { proceed } = await inquirer.prompt<{ proceed: boolean }>([
    {
      type: "confirm",
      name: "proceed",
      message:
        "This will permanently delete all Workers, D1 databases, and KV namespaces listed above. This cannot be undone. Continue?",
      default: false,
    },
  ])

  if (!proceed) {
    warn("Uninstall cancelled.")
    return
  }

  // Step 6: Delete resources
  const result = await deleteResources(accountId, uiResources, botResources)

  // Step 7: Summary
  console.log("")
  if (result.failed === 0) {
    success(
      `Uninstall complete! ${result.succeeded} resources deleted successfully.`,
    )
  } else {
    warn(
      `Uninstall completed with ${result.failed} failure(s). ${result.succeeded} resources deleted successfully.`,
    )
    warn("Review the errors above and manually clean up any remaining resources.")
  }
}

/**
 * Uninstall command definition
 */
export const uninstallCommand: CliCommand = {
  name: "uninstall",
  description:
    "Remove all Firela Connect Cloudflare resources (Workers, D1, KV)",
  handler: runUninstall,
}
