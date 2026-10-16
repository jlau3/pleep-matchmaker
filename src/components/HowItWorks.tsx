import Link from "next/link";
import { MAX_TOP } from "@/lib/lines";
import { MAX_FRIENDS } from "@/lib/friendship";
import { InviteButton } from "./InviteButton";

const STEPS: { title: string; body: React.ReactNode; href: string; cta: string }[] = [
  {
    title: "Set Up Your Profile",
    body: (
      <>
        Add your in-game name (IGN), friend code, and Pokémon Sleep icon so friends can recognize you.
      </>
    ),
    href: "/profile",
    cta: "Profile",
  },
  {
    title: "Vote on the Candy You Care About",
    body: (
      <>
        Choose <b>Want</b> for candy you need and <b>Don&apos;t Want</b> for candy you don't need. Leave the rest <b>Neutral</b>.
        Votes save automatically. Mark up to {MAX_TOP} candies as your <b>Top {MAX_TOP}</b>.
      </>
    ),
    href: "/vote",
    cta: "My Votes",
  },
  {
    title: "Add Your In-game Friends",
    body: (
      <>
        Look up your Pokémon Sleep friends by IGN or friend code and send a request.
        Their votes build your Tier List once they accept. You can connect with up to {MAX_FRIENDS} friends.
      </>
    ),
    href: "/friends",
    cta: "My Friends",
  },
  {
    title: "Find New Friends",
    body: (
      <>
        Find players who are a good candy match for you both. Send a request to connect here and share your friend code when needed.
      </>
    ),
    href: "/matches",
    cta: "Find New Friends",
  },
  {
    title: "See What Your Friends Want",
    body: (
      <>
        The Tier List ranks every candy by what your friends (or all players) want, so you know which candies to send
        the people you play with.
      </>
    ),
    href: "/tiers",
    cta: "Tier List",
  },
];

/**
 * What the app does, in five steps. Shown on the sign-in page and in the
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
        <h3 className="font-bold">Bring Your Friends Along</h3>
        <p className="mb-3 text-sm text-slate-700 dark:text-slate-200">
          Invite your Pokémon Sleep friends and ask them to vote so My Friends reflects the candy they want.
        </p>
        <InviteButton />
      </div>
      <p className="mt-5 text-xs text-slate-500">
        Manage who can find you in Profile. Players inactive for 2 months stop appearing in Find New Friends.
      </p>
    </div>
  );
}
