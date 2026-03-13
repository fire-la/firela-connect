/**
 * Service Toggle API Routes
 *
 * REST endpoints for managing service toggle state.
 *
 * @packageDocumentation
 */

import { Hono } from "hono"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"

import type { Env } from "../index.js"
import { getServiceState, setServiceEnabled } from "../services/service-toggle.js"
import type { ServiceId } from "../../types/services.js"

/**
 * Valid service IDs for validation
 */
const VALID_SERVICE_IDS: ServiceId[] = ["billclaw", "firelaBot"]

/**
 * Schema for PUT request body
 */
const toggleSchema = z.object({
  enabled: z.boolean(),
})

/**
 * Service toggle routes
 */
export const serviceRoutes = new Hono<{ Bindings: Env }>()

/**
 * GET /api/services - Get all service states
 *
 * Returns the current toggle state for all services.
 */
serviceRoutes.get("/", async (c) => {
  const state = await getServiceState(c.env)

  return c.json({
    success: true,
    data: state,
  })
})

/**
 * PUT /api/services/:id - Toggle a service
 *
 * Updates the enabled state of a specific service.
 *
 * Request body: { "enabled": boolean }
 */
serviceRoutes.put("/:id", zValidator("json", toggleSchema), async (c) => {
  const serviceId = c.req.param("id") as ServiceId
  const { enabled } = c.req.valid("json")

  // Validate service ID
  if (!VALID_SERVICE_IDS.includes(serviceId)) {
    return c.json(
      {
        success: false,
        error: `Invalid service ID. Must be one of: ${VALID_SERVICE_IDS.join(", ")}`,
        errorCode: "INVALID_SERVICE",
      },
      400,
    )
  }

  const state = await setServiceEnabled(c.env, serviceId, enabled)

  return c.json({
    success: true,
    data: state,
  })
})
