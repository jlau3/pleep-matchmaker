/** Shown when a server action throws (offline, or the site was redeployed under an open tab). */
export const SAVE_FAILED = "Couldn't save. The site may have just been updated. Refresh the page and try again.";

/**
 * Next.js signals redirect()/notFound() from a server action by throwing; those
 * must propagate so the navigation happens. Everything else is a real failure.
 */
export function rethrowIfNavigation(error: unknown): void {
  const digest = (error as { digest?: unknown } | null)?.digest;
  if (typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR"))) {
    throw error;
  }
}
