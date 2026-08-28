import { Request, Response, NextFunction } from "express";
import xss from "xss";

/**
 * Text fields that appear across user-generated content. Every string value
 * in these fields is sanitized before it reaches a controller or Mongoose
 * query. Add field names here as new endpoints accept user input.
 */
const SANITIZED_FIELDS = new Set([
  // Auth / Profile
  "name",
  "email",
  "phone",
  "farmName",
  "description",
  // Products
  "productName",
  "unit",
  "seoDescription",
  // Orders
  "notes",
  "trackingId",
  "fullName",
  "street",
  "city",
  "state",
  "pincode",
  // Categories
  "slug",
  "icon",
  // Address
  "label",
  // Newsletter
  "comment",
  // General
  "search",
  "q",
]);

/** Recursively sanitize string values inside an object/array. */
function sanitizeDeep(obj: unknown): unknown {
  if (typeof obj === "string") {
    return xss(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeDeep);
  }
  if (obj !== null && typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (SANITIZED_FIELDS.has(key) && typeof value === "string") {
        out[key] = xss(value);
      } else {
        out[key] = sanitizeDeep(value);
      }
    }
    return out;
  }
  return obj;
}

/**
 * Middleware that sanitizes `req.body`, `req.query`, and `req.params` to
 * prevent stored XSS. The sanitization is lightweight (xss lib) and only
 * targets known text fields — numeric/boolean/mongo fields are untouched.
 */
export function sanitizeInput(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeDeep(req.body);
  }
  // Mutate query/param values in-place rather than reassigning — avoids
  // type mismatch with Express's ParsedQs / string types.
  if (req.query && typeof req.query === "object") {
    for (const key of Object.keys(req.query)) {
      const val = req.query[key];
      if (typeof val === "string") {
        (req.query as Record<string, unknown>)[key] = xss(val);
      }
    }
  }
  if (req.params && typeof req.params === "object") {
    for (const key of Object.keys(req.params)) {
      const val = req.params[key];
      if (typeof val === "string") {
        (req.params as Record<string, unknown>)[key] = xss(val);
      }
    }
  }
  next();
}
