import { FeedbackLink } from "./FeedbackLink";

/**
 * Quiet footer on every page: a feedback link, and a donation link once
 * NEXT_PUBLIC_DONATION_URL is set (e.g. a Ko-fi page).
 */
export function SupportFooter() {
  const donateUrl = process.env.NEXT_PUBLIC_DONATION_URL;
  return (
    <footer className="mx-auto flex max-w-5xl flex-wrap justify-center gap-x-4 gap-y-1 px-4 pb-8 text-center text-xs text-slate-500">
      <FeedbackLink />
      {donateUrl && (
        <span>
          Enjoying Pleep Matchmaker?{" "}
          <a href={donateUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-800 dark:hover:text-white">
            Buy me a coffee or help with server costs
          </a>
        </span>
      )}
    </footer>
  );
}
