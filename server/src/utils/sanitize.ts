/**
 * Escape special regex characters in a string so it can be safely used in a
 * MongoDB `{ $regex: ... }` query without ReDoS or injection risks.
 *
 * Call this on every user-supplied value before it enters a `$regex` filter.
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
