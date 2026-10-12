/** Cookie holding where to land after Discord sign-in (e.g. a shared "look me up" link). */
export const NEXT_COOKIE = "pm_next";

/** Accepts only same-site paths like "/friends?q=bob" (no "//host" or "/\\host" open redirects). */
export function safeNextPath(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 300) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  return value;
}
