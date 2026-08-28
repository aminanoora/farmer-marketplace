/**
 * Order status-transition helpers.
 *
 * Defines which status transitions are allowed for each role
 * and provides a utility to validate them.
 */

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "out-for-delivery"
  | "delivered"
  | "cancelled";

/**
 * Allowed forward transitions for farmers.
 * Farmers can only move orders forward in the fulfillment pipeline.
 */
const FARMER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["preparing"],
  preparing: ["out-for-delivery"],
  "out-for-delivery": ["delivered"],
  delivered: [],    // terminal
  cancelled: [],    // terminal
};

/**
 * Allowed transitions for admins.
 * Admins have broader control but cannot move orders backwards
 * through the fulfillment pipeline (only forward or cancel).
 */
const ADMIN_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["out-for-delivery", "cancelled"],
  "out-for-delivery": ["delivered", "cancelled"],
  delivered: [],    // terminal — admin cannot un-deliver
  cancelled: [],    // terminal — admin cannot un-cancel
};

/** Terminal statuses that cannot transition to anything. */
const TERMINAL_STATUSES: OrderStatus[] = ["delivered", "cancelled"];

/**
 * Check whether a status transition is allowed for the given role.
 * Returns `null` if valid, or a human-readable error message if not.
 */
export function validateStatusTransition(
  currentStatus: OrderStatus,
  newStatus: OrderStatus,
  role: "admin" | "farmer"
): string | null {
  if (currentStatus === newStatus) {
    return null; // no-op is always fine
  }

  if (TERMINAL_STATUSES.includes(currentStatus)) {
    return `Cannot change status from "${currentStatus}" — this is a terminal state.`;
  }

  const allowed = role === "admin"
    ? ADMIN_TRANSITIONS[currentStatus]
    : FARMER_TRANSITIONS[currentStatus];

  if (!allowed.includes(newStatus)) {
    return role === "admin"
      ? `Admin cannot transition from "${currentStatus}" to "${newStatus}". Allowed: ${allowed.join(", ") || "(none)"}`
      : `Farmer cannot transition from "${currentStatus}" to "${newStatus}". Allowed: ${allowed.join(", ") || "(none)"}`;
  }

  return null; // valid
}
