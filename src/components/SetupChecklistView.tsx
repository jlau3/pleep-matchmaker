"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { markSetupDone } from "@/app/actions";
import { SETUP_COOKIE, SETUP_SNOOZE_KEY } from "@/lib/help";
import { rethrowIfNavigation, SAVE_FAILED } from "@/lib/saveError";
import { currentStep, SETUP_VOTE_EVENT, type SetupStep } from "@/lib/setup";

/**
 * The checklist card. "Hide for now" hides it until the browser session ends;
 * "Skip setup" hides it for good. Opening the Tier List with the first three
 * steps done finishes it with a short "all set" note. Already done: remembers
 * that in this browser and shows nothing.
 */
export function SetupChecklistView({ userId, done, steps }: { userId: string; done: boolean; steps: SetupStep[] }) {
  const pathname = usePathname();
  const router = useRouter();
  // Hidden until sessionStorage is read, so a snoozed card never flashes on load.
  const [snoozed, setSnoozed] = useState(true);
  const [finished, setFinished] = useState(false);
  const [closed, setClosed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<{ message: string; finishing: boolean } | null>(null);
  const completionAttempted = useRef(false);

  const saveSetup = useCallback(async (finishing: boolean) => {
    setSaving(true);
    setFailure(null);
    try {
      const result = await markSetupDone(finishing);
      if (result.error) setFailure({ message: result.error, finishing });
      else {
        if (finishing) setFinished(true);
        else setClosed(true);
        if (result.next) router.push(result.next);
      }
    } catch (error) {
      rethrowIfNavigation(error);
      setFailure({ message: SAVE_FAILED, finishing });
    } finally {
      setSaving(false);
    }
  }, [router]);

  useEffect(() => {
    if (done) {
      document.cookie = `${SETUP_COOKIE}=${userId}; path=/; max-age=31536000; samesite=lax`;
      return;
    }
    try {
      setSnoozed(sessionStorage.getItem(SETUP_SNOOZE_KEY) === userId);
    } catch {
      setSnoozed(false); // Storage unavailable: show it.
    }
  }, [done, userId]);

  const [savedVote, setSavedVote] = useState<boolean | null>(null);
  useEffect(() => {
    setSavedVote(null);
  }, [steps, userId]);
  useEffect(() => {
    const update = (event: Event) => {
      const progress = (event as CustomEvent<{ userId: string; voted: boolean }>).detail;
      if (progress?.userId === userId && typeof progress.voted === "boolean") setSavedVote(progress.voted);
    };
    window.addEventListener(SETUP_VOTE_EVENT, update);
    return () => window.removeEventListener(SETUP_VOTE_EVENT, update);
  }, [userId]);
  const savedSteps = steps.map((item) => (item.id === "vote" && savedVote !== null ? { ...item, done: savedVote } : item));
  const readyForTiers = savedSteps.length > 0 && savedSteps.every((item) => item.id === "tiers" || item.done);
  const visibleSteps = savedSteps.map((item) =>
    item.id === "tiers" && readyForTiers && pathname === "/tiers" ? { ...item, done: true } : item,
  );
  const step = visibleSteps.length ? currentStep(visibleSteps) : null;
  // Reaching the Tier List with everything else done is the last step.
  useEffect(() => {
    if (done || snoozed || completionAttempted.current || step?.id !== "tiers" || pathname !== "/tiers") return;
    completionAttempted.current = true;
    void saveSetup(true);
  }, [done, snoozed, step?.id, pathname, saveSetup]);

  if (done || closed || !step) return null;
  if (finished)
    return (
      <Shell>
        <span className="flex-1">
          🎉 <strong>You&apos;re all set!</strong> Check back when new Pokémon come out, and keep your friend list matching the game.
        </span>
        <CloseButton onClick={() => setClosed(true)} />
      </Shell>
    );
  if (snoozed) return null;

  const index = visibleSteps.indexOf(step);
  const completed = visibleSteps.filter((item) => item.done).length;
  const snooze = () => {
    setSnoozed(true);
    try {
      sessionStorage.setItem(SETUP_SNOOZE_KEY, userId);
    } catch {
      // Hidden for this page only; fine.
    }
  };
  const here = pathname === step.href.split("?")[0];
  const after = visibleSteps.slice(index + 1).find((s) => !s.done);

  return (
    <Shell>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <strong className="text-base">Get set up</strong>
          <span role="status" className="text-xs font-semibold text-slate-500">
            {completed} of {visibleSteps.length} complete
          </span>
        </div>
        <progress aria-label="Setup progress" value={completed} max={visibleSteps.length} className="mt-1.5 h-1.5 w-full accent-want" />
        <ol aria-label="Setup checklist" className="mt-2 grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap">
          {visibleSteps.map((item, i) => (
            <li
              key={item.id}
              data-setup-step={item.id}
              data-complete={item.done}
              aria-current={!item.done && item.id === step.id ? "step" : undefined}
              className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 ${
                item.done
                  ? "border-want/40 bg-want/10"
                  : item.id === step.id
                    ? "border-sun-deep bg-sun/20"
                    : "border-slate-300 bg-white/50 dark:border-slate-600 dark:bg-night/40"
              }`}
            >
              <span
                aria-hidden="true"
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${item.done ? "bg-want text-night-deep" : item.id === step.id ? "bg-sun text-[#5b3e00]" : "border border-slate-400 text-slate-500"}`}
              >
                {item.done ? "✓" : i + 1}
              </span>
              <span className="text-xs font-semibold">
                <span className="sr-only">{item.done ? "Complete: " : "To do: "}</span>
                {item.label}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
          <strong>Step {index + 1} of {visibleSteps.length}</strong> · {step.next}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {step.id === "friends" ? (
            <button type="button" className="btn-primary px-3 py-1 text-sm" onClick={() => {
              const search = document.getElementById("player-search");
              if (search) {
                search.focus({ preventScroll: true });
                search.scrollIntoView({ block: "nearest" });
              } else router.push(step.href);
            }}>
              {step.cta} →
            </button>
          ) : !here ? (
            <Link href={step.href} className="btn-primary px-3 py-1 text-sm">
              {step.cta} →
            </Link>
          ) : step.href.startsWith("/profile") ? (
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event("pm-profile-guide-open"))}
              className="btn-primary px-3 py-1 text-sm"
            >
              {step.cta} →
            </button>
          ) : (
            after && (
              // Players can explore freely; completed steps still come from their saved data.
              <Link href={after.href} className="text-sm font-semibold underline">
                Continue to {after.label} →
              </Link>
            )
          )}
          <button type="button" onClick={snooze} disabled={saving} className="text-xs font-semibold text-slate-500 underline">
            Hide for this session
          </button>
          <button
            type="button"
            onClick={() => void saveSetup(false)}
            disabled={saving}
            className="text-xs font-semibold text-slate-500 underline"
          >
            Don't show again
          </button>
        </div>
        {saving && (
          <p role="status" className="mt-2 text-xs text-slate-500">
            Saving setup progress…
          </p>
        )}
        {failure && (
          <p role="alert" className="mt-2 text-sm text-dont">
            {failure.message}{" "}
            <button type="button" disabled={saving} onClick={() => void saveSetup(failure.finishing)} className="font-semibold underline">
              Try again
            </button>
          </p>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl px-4 pt-3">
      <div className="flex items-start gap-3 rounded-2xl border border-sun/60 bg-sun/15 px-4 py-3 text-sm">{children}</div>
    </div>
  );
}

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Close"
      className="shrink-0 rounded-full px-2 text-lg leading-none text-slate-500 hover:text-slate-800 dark:hover:text-white"
    >
      ×
    </button>
  );
}
