"use client";

import { useActionState } from "react";
import { type ProfileFormState, updateProfile } from "@/app/actions";
import { formatFriendCode } from "@/lib/format";
import type { OwnProfile } from "@/lib/types";

export function ProfileForm({ profile, friendListFull }: { profile: OwnProfile; friendListFull: boolean }) {
  const [state, action, pending] = useActionState<ProfileFormState, FormData>(updateProfile, {});
  const input = "w-full field";
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
          <span className="text-xs text-slate-500">
            {friendListFull
              ? "Your friend list is full, so you're hidden from matches until you remove someone."
              : "Turn off to hide from matches. You're hidden automatically while your friend list is full."}{" "}
            Off also hides your friend code from people who find you by name; your friends, and anyone who types your code
            in, still see it.
          </span>
        </span>
      </label>
      {profile.discord_username && (
        <label className="flex items-start gap-3">
          <input type="hidden" name="has_show_discord" value="1" />
          <input type="checkbox" name="show_discord" defaultChecked={profile.show_discord} className="mt-1 h-4 w-4" />
          <span>
            <span className="block text-sm font-medium">Show my Discord name</span>
            <span className="text-xs text-slate-500">
              Off: other players see your IGN instead of @{profile.discord_username} and your Discord picture, and can only
              find you by IGN or friend code.
            </span>
          </span>
        </label>
      )}
      <label className="flex items-start gap-3">
        <input type="checkbox" name="allow_lookup" defaultChecked={profile.allow_lookup} className="mt-1 h-4 w-4" />
        <span>
          <span className="block text-sm font-medium">Let people look me up</span>
          <span className="text-xs text-slate-500">
            Anyone who searches your IGN or friend code{profile.discord_username && profile.show_discord ? " (or Discord name)" : ""}{" "}
            can see your candy list.
          </span>
        </span>
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="btn-primary px-5 py-2"
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
