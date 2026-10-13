"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Shown in place of a page that failed to load (a Supabase hiccup, a timeout),
 * with the nav still there. "Try again" re-requests just this page.
 */
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="card mx-auto max-w-md space-y-4 p-6 text-center">
      <h1 className="text-xl font-extrabold">Something went wrong loading this page</h1>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        It&apos;s usually a brief connection blip. Your votes and friends are safe.
      </p>
      <button type="button" onClick={reset} className="btn-primary px-6 py-2">
        Try again
      </button>
      <p className="text-xs text-slate-500">
        Still broken?{" "}
        <Link href={`/feedback?from=error${error.digest ? `-${error.digest}` : ""}`} className="underline">
          Let us know
        </Link>
        .
      </p>
    </div>
  );
}
