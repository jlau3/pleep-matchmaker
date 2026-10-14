import Link from "next/link";

/** Quiet footer on every page. Feedback and the donation link live in the nav (NavExtras). */
export function SupportFooter() {
  return (
    <footer className="mx-auto flex max-w-5xl flex-wrap justify-center gap-x-4 gap-y-1 px-4 pb-8 text-center text-xs text-slate-500">
      <Link href="/privacy" className="underline hover:text-slate-800 dark:hover:text-white">
        Privacy
      </Link>
    </footer>
  );
}
