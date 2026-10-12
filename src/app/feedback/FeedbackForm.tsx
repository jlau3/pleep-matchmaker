"use client";

import { useActionState } from "react";
import { type FeedbackState, sendFeedback } from "./actions";

const KINDS: [string, string][] = [
  ["bug", "Something's broken"],
  ["idea", "Idea"],
  ["other", "Other"],
];

export function FeedbackForm({ page }: { page: string }) {
  const [state, action, pending] = useActionState<FeedbackState, FormData>(sendFeedback, {});
  if (state.sent) {
    return <p className="rounded-xl bg-want/15 px-4 py-3 font-semibold text-want">Thanks! Your feedback was sent.</p>;
  }
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="page" value={page} />
      <fieldset>
        <legend className="mb-2 text-sm font-medium">What kind of feedback?</legend>
        <div className="flex flex-wrap gap-2">
          {KINDS.map(([value, label], i) => (
            <label
              key={value}
              className="cursor-pointer rounded-full border border-slate-300 px-3 py-1 text-sm has-[:checked]:border-transparent has-[:checked]:bg-night has-[:checked]:text-white dark:border-slate-700 dark:has-[:checked]:bg-sun dark:has-[:checked]:text-[#5b3e00]"
            >
              <input type="radio" name="kind" value={value} defaultChecked={i === 0} className="sr-only" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block space-y-1">
        <span className="text-sm font-medium">Your message</span>
        <textarea
          name="message"
          required
          minLength={5}
          maxLength={1500}
          rows={6}
          className="field w-full rounded-2xl"
          placeholder="What happened, or what would you like to see?"
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary px-5 py-2">
          {pending ? "Sending…" : "Send feedback"}
        </button>
        {state.error && (
          <span role="alert" className="text-sm text-dont">
            {state.error}
          </span>
        )}
      </div>
    </form>
  );
}
