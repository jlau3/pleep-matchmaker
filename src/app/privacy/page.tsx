import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy · Pleep Matchmaker" };

const UPDATED = "October 13, 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="space-y-2 text-sm text-slate-700 dark:text-slate-300">{children}</div>
    </section>
  );
}

/** Public (no sign-in needed): Google's OAuth consent screen links here. */
export default function PrivacyPage() {
  return (
    <article className="card mx-auto max-w-2xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-extrabold">Privacy policy</h1>
        <p className="text-sm text-slate-500">Last updated {UPDATED}</p>
      </header>

      <p className="text-sm text-slate-700 dark:text-slate-300">
        Pleep Matchmaker is a free fan-made tool for Pokémon Sleep players to share which candy they want and find friends.
        This page explains what it stores and who can see it. Short version: we keep only what the app needs, we never show
        your email to anyone, and we don&apos;t sell data, run ads or use trackers.
      </p>

      <Section title="What we store">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>Sign-in details.</b> Depending on how you sign in: your Discord ID, username, display name and avatar; or your
            Google account&apos;s email; or the email you typed for a sign-in link. From Google we only keep the email, never your
            name or photo.
          </li>
          <li>
            <b>What you enter.</b> Your in-game name (IGN), friend code, candy votes and Top 3, friends list, blocked players,
            and settings.
          </li>
          <li>
            <b>Activity.</b> When you were last active and when your votes last changed, so inactive players drop out of
            matching after 2 months. If you remove a friend and say they stopped playing, we note that too.
          </li>
          <li>
            <b>Feedback you send.</b> The message, the page you sent it from, and your Discord name or IGN, delivered to the
            developer&apos;s private Discord channel.
          </li>
          <li>
            <b>Cookies.</b> Only ones the app needs: your sign-in session, and small preferences like your theme and whether
            you&apos;ve seen the help popup. No advertising or analytics cookies.
          </li>
        </ul>
      </Section>

      <Section title="Who can see what">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>Other players</b> can see your IGN, friend code, candy votes and Top 3, when you were last active, and your
            Discord name and avatar if <b>Show my Discord name</b> is on. They see this when they search for your exact name
            or friend code, when you appear in their matches, or when they&apos;ve added you as a friend.
          </li>
          <li>
            <b>Nobody else ever sees your email.</b> It&apos;s only used to sign you in.
          </li>
          <li>
            <b>You control it</b> in Profile → Settings: turn off &quot;Let people look me up&quot; to hide your list from
            searches and friends, turn off &quot;Open to new friends&quot; to leave matching, hide your Discord name, or block
            anyone.
          </li>
          <li>
            <b>The developer</b> can see the database, including sign-in emails, to run and fix the app.
          </li>
        </ul>
      </Section>

      <Section title="Services we use">
        <p>
          Supabase stores the data and handles sign-in. Vercel hosts the site. Discord and Google handle their own sign-in
          screens under their own privacy policies. Sign-in emails are sent through an email delivery service. Each only
          gets what it needs to do that job.
        </p>
      </Section>

      <Section title="Keeping and deleting your data">
        <p>
          We keep your data while you have an account. Delete it any time in{" "}
          <Link href="/profile" className="underline">
            Profile → Settings → Delete account
          </Link>
          : that removes your profile, votes, friends list and blocks right away. Feedback already sent to Discord isn&apos;t
          removed automatically; ask and we&apos;ll delete it.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions or requests: use{" "}
          <Link href="/feedback" className="underline">
            Send feedback
          </Link>{" "}
          (at the bottom of every page). If this policy changes, the date above changes with it.
        </p>
        <p className="text-xs text-slate-500">
          Pleep Matchmaker isn&apos;t affiliated with Nintendo, The Pokémon Company, Game Freak or SELECT BUTTON. Pokémon and
          Pokémon Sleep are trademarks of their respective owners.
        </p>
      </Section>
    </article>
  );
}
