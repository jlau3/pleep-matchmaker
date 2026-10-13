"use client";

import { useActionState } from "react";
import { type MagicLinkState, sendMagicLink, signInWithOAuth } from "@/app/actions";

const oauthButton =
  "w-full rounded-full px-6 py-3 text-lg font-extrabold active:translate-y-[2px]";

/**
 * Discord, Google, or an emailed one-time link. Only Discord shows a name to
 * other players (and only if the player allows it); Google and email players
 * are known by their IGN.
 */
export function SignInOptions({ next }: { next: string | null }) {
  const [state, emailAction, sending] = useActionState<MagicLinkState, FormData>(sendMagicLink, {});
  const nextField = next && <input type="hidden" name="next" value={next} />;

  return (
    <div className="space-y-3">
      <form action={signInWithOAuth}>
        {nextField}
        <input type="hidden" name="provider" value="discord" />
        <button
          type="submit"
          className={`${oauthButton} bg-[#5865F2] text-white shadow-[0_3px_0_#3c45a5] hover:brightness-105 active:shadow-[0_1px_0_#3c45a5]`}
        >
          Sign in with Discord
        </button>
      </form>
      <form action={signInWithOAuth}>
        {nextField}
        <input type="hidden" name="provider" value="google" />
        <button
          type="submit"
          className={`${oauthButton} border border-slate-300 bg-white text-slate-800 shadow-[0_3px_0_#cbd5e1] hover:bg-slate-50 active:shadow-[0_1px_0_#cbd5e1]`}
        >
          Sign in with Google
        </button>
      </form>

      <div className="flex items-center gap-3 py-1 text-xs uppercase tracking-wide text-slate-400">
        <span className="h-px flex-1 bg-slate-300 dark:bg-slate-600" />
        or use your email
        <span className="h-px flex-1 bg-slate-300 dark:bg-slate-600" />
      </div>

      {state.sentTo ? (
        <p role="status" className="rounded-2xl bg-want/15 px-4 py-3 text-sm font-semibold text-want">
          Check your inbox at {state.sentTo}. Tap the link in the email to sign in (it works once, for an hour).
        </p>
      ) : (
        <form action={emailAction} className="space-y-2 text-left">
          {nextField}
          <label className="block">
            <span className="sr-only">Email</span>
            <input name="email" type="email" required autoComplete="email" placeholder="you@example.com" className="field w-full" />
          </label>
          <button type="submit" disabled={sending} className="btn-primary w-full py-2">
            {sending ? "Sending…" : "Email me a sign-in link"}
          </button>
          {state.error && (
            <p role="alert" className="text-sm text-dont">
              {state.error}
            </p>
          )}
          <p className="text-xs text-slate-500">No password. Your email is never shown to other players.</p>
        </form>
      )}
    </div>
  );
}
