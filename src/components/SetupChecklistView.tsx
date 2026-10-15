"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { markSetupDone } from "@/app/actions";
import { SETUP_COOKIE, SETUP_SNOOZE_KEY } from "@/lib/help";
import { currentStep, type SetupStep } from "@/lib/setup";

/**
 * The checklist card. "Not now" hides it until the browser session ends;
 * "Skip setup" hides it for good. Opening the Tier List with the first three
 * steps done finishes it with a short "all set" note. Already done: remembers
 * that in this browser and shows nothing.
 */
export function SetupChecklistView({ userId, done, steps }: { userId: string; done: boolean; steps: SetupStep[] }) {
  const pathname = usePathname();
  // Hidden until sessionStorage is read, so a snoozed card never flashes on load.
  const [snoozed, setSnoozed] = useState(true);
  const [finished, setFinished] = useState(false);
  const [closed, setClosed] = useState(false);

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

  const step = steps.length ? currentStep(steps) : null;
  // Reaching the Tier List with everything else done is the last step.
  useEffect(() => {
    if (done || finished || step?.id !== "tiers" || pathname !== "/tiers") return;
    setFinished(true);
    void markSetupDone(true).catch(() => {});
  }, [done, finished, step?.id, pathname]);

  if (done || closed || !step) return null;
  if (finished)
    return (
      <Shell>
        <span className="flex-1">
          🎉 <strong>You&apos;re all set!</strong> Check back when new Pokémon come out, and keep your friend list matching
          the game.
        </span>
        <CloseButton onClick={() => setClosed(true)} />
      </Shell>
    );
  if (snoozed) return null;

  const index = steps.indexOf(step);
  const snooze = () => {
    setSnoozed(true);
    try {
      sessionStorage.setItem(SETUP_SNOOZE_KEY, userId);
    } catch {
      // Hidden for this page only; fine.
    }
  };
  const skip = () => {
    setClosed(true);
    void markSetupDone().catch(() => {});
  };
  const here = pathname === step.href.split("?")[0];
  const after = steps.slice(index + 1).find((s) => !s.done);

  return (
    <Shell>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <strong>Get set up</strong>
          <ol className="flex flex-wrap items-center gap-1.5 text-xs" aria-label={`Step ${index + 1} of ${steps.length}`}>
            {steps.map((s, i) => (
              <li
                key={s.id}
                aria-current={s === step ? "step" : undefined}
                className={`rounded-full px-2 py-0.5 font-semibold ${
                  s.done ? "bg-want/20 text-want" : s === step ? "bg-sun text-[#5b3e00]" : "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-300"
                }`}
              >
                {s.done ? "✓ " : `${i + 1}. `}
                {s.label}
              </li>
            ))}
          </ol>
        </div>
        <p className="mt-1 text-slate-700 dark:text-slate-200">{step.next}</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {!here ? (
            <Link href={step.href} className="btn-primary px-3 py-1 text-sm">
              {step.cta} →
            </Link>
          ) : (
            after && (
              // Already on this step's page: the step ticks off once you move on.
              <Link href={after.href} className="text-sm font-semibold underline">
                Done? {after.cta} →
              </Link>
            )
          )}
          <button type="button" onClick={snooze} className="text-xs font-semibold text-slate-500 underline">
            Not now
          </button>
          <button type="button" onClick={skip} className="text-xs font-semibold text-slate-500 underline">
            Skip setup
          </button>
        </div>
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
    <button type="button" onClick={onClick} aria-label="Close" className="shrink-0 rounded-full px-2 text-lg leading-none text-slate-500 hover:text-slate-800 dark:hover:text-white">
      ×
    </button>
  );
}
