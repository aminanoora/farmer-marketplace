import { Request, Response, NextFunction } from "express";
import PlatformSettings from "../models/PlatformSettings";

/**
 * Maintenance mode middleware.
 *
 * When PlatformSettings.maintenanceMode is true, all API routes except
 * admin auth (login/me) and the health check are blocked with 503.
 *
 * The setting is cached for 60 seconds to avoid a DB query on every request.
 * Admin routes bypass this middleware so admins can disable maintenance mode.
 */
let cachedMaintenance: boolean | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000; // 60 seconds

async function getMaintenanceMode(): Promise<boolean> {
  const now = Date.now();
  if (cachedMaintenance !== null && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedMaintenance;
  }

  try {
    const settings = await PlatformSettings.findOne().lean();
    cachedMaintenance = settings?.maintenanceMode ?? false;
    cacheTimestamp = now;
  } catch {
    // On DB error, use cached value or default to false (open)
    if (cachedMaintenance === null) cachedMaintenance = false;
  }

  return cachedMaintenance;
}

/**
 * Express middleware that returns 503 when maintenance mode is active.
 *
 * Admin routes should NOT use this middleware so admins can still log in
 * and toggle maintenance mode off.
 */
export const maintenanceMode = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Skip for health check and root
  if (req.path === "/health" || req.path === "/") {
    next();
    return;
  }

  try {
    const isMaintenance = await getMaintenanceMode();
    if (isMaintenance) {
      res.status(503).json({
        message:
          "The platform is currently under maintenance. Please try again later.",
        retryAfter: 60,
      });
      return;
    }
    next();
  } catch {
    // If the check fails, let the request through (fail-open)
    next();
  }
};

/**
 * Reset the maintenance mode cache. Call this after toggling maintenance mode
 * so the next request picks up the new value immediately.
 */
export function resetMaintenanceCache(): void {
  cachedMaintenance = null;
  cacheTimestamp = 0;
}
