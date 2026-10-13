import Link from "next/link";
import { MAX_TOP } from "@/lib/lines";
import { MAX_FRIENDS } from "@/lib/friendship";
import { InviteButton } from "./InviteButton";

const STEPS: { title: string; body: React.ReactNode; href: string; cta: string }[] = [
  {
    title: "Vote on every candy",
    body: (
      <>
        Mark each Pokémon Sleep candy line <b>Want</b>, <b>Don&apos;t Want</b> or leave it <b>Neutral</b>. Tap the ★ to
        pick your Top {MAX_TOP}: your personal favorites. They don&apos;t move the Tier List, so a niche pick never
        counts against you. Friends can see them and send you that candy anyway, wherever it ranks.
      </>
    ),
    href: "/vote",
    cta: "My Votes",
  },
  {
    title: "See what your friends want",
    body: (
      <>
        The Tier List ranks every candy by what your friends (or all players) want, so you know which candies to send
        the people you play with.
      </>
    ),
    href: "/tiers",
    cta: "Tier List",
  },
  {
    title: "Add your in-game friends",
    body: (
      <>
        Look them up by exact name, IGN or friend code and add up to {MAX_FRIENDS}. Each player shows a fit %: how
        closely their wants and don&apos;t-wants line up with your current friends list.
      </>
    ),
    href: "/friends",
    cta: "My Friends",
  },
  {
    title: "Find new friends",
    body: (
      <>
        Find New Friends suggests players whose wants fit what your friends already want. Copy their friend code and add them in
        Pokémon Sleep.
      </>
    ),
    href: "/matches",
    cta: "Find New Friends",
  },
];

/**
 * What the app does, in four steps. Shown on the sign-in page and in the
 * How it works popup (HelpModal), which opens from the ? in the nav and by
 * itself on a player's first sign-in.
 */
export function HowItWorks({ links = true }: { links?: boolean }) {
  return (
    <div>
      <ol className="space-y-4">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sun font-extrabold text-[#5b3e00]">
              {i + 1}
            </span>
            <div>
              <h3 className="font-bold">{step.title}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">{step.body}</p>
              {links && (
                <Link href={step.href} className="text-sm font-semibold underline">
                  {step.cta} →
                </Link>
              )}
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-5 rounded-2xl bg-sun/25 p-4">
        <h3 className="font-bold">Bring your friends along</h3>
        <p className="mb-3 text-sm text-slate-700 dark:text-slate-200">
          The tier list only knows what your friends have voted. Send your Pokémon Sleep friends an invite and ask them
          to add their wants and Top 3.
        </p>
        <InviteButton />
      </div>
      <p className="mt-5 text-xs text-slate-500">
        Your friend code and IGN are only shown to matches and to people who look you up by exact name. You can turn off
        matching or lookup in Profile → Settings, and stay hidden from matches automatically once your friend list is full.
        Players inactive for 4 months drop out of matching.
      </p>
    </div>
  );
}
