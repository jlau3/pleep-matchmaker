"use client";

import { useActionState } from "react";
import { type ProfileFormState, updateProfile } from "@/app/actions";
import { formatFriendCode } from "@/lib/format";
import type { OwnProfile } from "@/lib/types";

export function ProfileForm({ profile }: { profile: OwnProfile }) {
  const [state, action, pending] = useActionState<ProfileFormState, FormData>(updateProfile, {});
  const input = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900";
  return (
    <form action={action} className="space-y-4">
      <label className="block space-y-1">
        <span className="text-sm font-medium">In-game name</span>
        <input name="ign" defaultValue={profile.ign ?? ""} maxLength={40} className={input} />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium">Friend code</span>
        <input
          name="friend_code"
          defaultValue={profile.friend_code ? formatFriendCode(profile.friend_code) : ""}
          inputMode="numeric"
          placeholder="1234 5678 9012"
          className={`${input} font-mono`}
        />
        <span className="text-xs text-slate-500">You won't show up in other people's matches until this is set.</span>
      </label>
      <label className="flex items-start gap-3">
        <input type="checkbox" name="open_to_friends" defaultChecked={profile.open_to_friends} className="mt-1 h-4 w-4" />
        <span>
          <span className="block text-sm font-medium">Open to new friends</span>
          <span className="text-xs text-slate-500">Turn off when your friend list is full. You'll be hidden from matches.</span>
        </span>
      </label>
      <label className="flex items-start gap-3">
        <input type="checkbox" name="allow_lookup" defaultChecked={profile.allow_lookup} className="mt-1 h-4 w-4" />
        <span>
          <span className="block text-sm font-medium">Let people look me up</span>
          <span className="text-xs text-slate-500">
            Anyone who knows your exact Discord name, IGN or friend code can see your candy list.
          </span>
        </span>
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {state.saved && !pending && <span className="text-sm text-want">Saved</span>}
        {state.error && (
          <span role="alert" className="text-sm text-dont">
            {state.error}
          </span>
        )}
      </div>
    </form>
  );
}
