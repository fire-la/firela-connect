/**
 * Service Toggle Middleware
 *
 * Blocks requests to disabled service routes with 503 response.
 *
 * @packageDocumentation
 */

import type { Context, Next } from "hono"
import type { Env } from "../index.js"
import type { ServiceId } from "../../types/services.js"
import { getServiceState } from "../services/service-toggle.js"

/**
 * Map route prefixes to service IDs
 *
 * Routes starting with these prefixes are protected by the corresponding service toggle.
 */
const ROUTE_SERVICE_MAP: Record<string, ServiceId> = {
  "/api/oauth/plaid": "billclaw",
  "/api/connect": "billclaw",
  "/api/sync": "billclaw",
  "/api/export": "billclaw",
  "/webhook": "billclaw",
  "/api/bot": "firelaBot",
  "/api/messages": "firelaBot",
}

/**
 * Exempt routes that should never be blocked
 *
 * These routes are always accessible regardless of service state.
 * Note: Only exact matches for /api and /api/services, not prefixes.
 */
const EXEMPT_ROUTE_PREFIXES = ["/health", "/api/services"]
const EXEMPT_EXACT_ROUTES = ["/api"]

/**
 * Find the service ID for a given path
 *
 * @param path - Request path
 * @returns Service ID if route is protected, null otherwise
 */
function findServiceForPath(path: string): ServiceId | null {
  // Check exact exempt routes first (e.g., /api exactly, not /api/*)
  if (EXEMPT_EXACT_ROUTES.includes(path)) {
    return null
  }

  // Check exempt route prefixes (e.g., /health/*, /api/services/*)
  for (const exempt of EXEMPT_ROUTE_PREFIXES) {
    if (path === exempt || path.startsWith(exempt + "/")) {
      return null
    }
  }

  // Find matching service
  for (const [prefix, serviceId] of Object.entries(ROUTE_SERVICE_MAP)) {
    if (path.startsWith(prefix)) {
      return serviceId
    }
  }

  // No service mapping = not protected
  return null
}

/**
 * Service toggle middleware
 *
 * Checks if the requested route belongs to a disabled service.
 * Returns 503 Service Unavailable if the service is disabled.
 */
export function serviceToggleMiddleware() {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const path = c.req.path

    // Find which service (if any) this route belongs to
    const matchedService = findServiceForPath(path)

    // No service mapping = always allowed
    if (!matchedService) {
      return next()
    }

    // Check if service is enabled
    const state = await getServiceState(c.env)

    if (!state[matchedService]) {
      return c.json(
        {
          success: false,
          error: `${matchedService} service is disabled`,
          errorCode: "SERVICE_DISABLED",
          serviceId: matchedService,
        },
        503,
      )
    }

    return next()
  }
}
