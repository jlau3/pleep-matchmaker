"use client";

import { useActionState, useRef } from "react";
import { type ProfileFormState, updateProfile } from "@/app/actions";
import { formatFriendCode } from "@/lib/format";
import type { OwnProfile } from "@/lib/types";
import { AvatarPicker } from "./AvatarPicker";
import { DiscordIcon, RedditIcon } from "./BrandIcons";

export function ProfileForm({ profile, friendListFull }: { profile: OwnProfile; friendListFull: boolean }) {
  const [state, action, pending] = useActionState<ProfileFormState, FormData>(updateProfile, {});
  const input = "w-full field";
  // No Save button: checkboxes save on click, text fields when you leave them (or press Enter), the icon from its popup.
  const form = useRef<HTMLFormElement>(null);
  const save = () => form.current?.requestSubmit();
  const saveIfChanged = (e: React.FocusEvent<HTMLInputElement>) => {
    if (e.currentTarget.value !== e.currentTarget.defaultValue) save();
  };
  return (
    <form ref={form} action={action} className="space-y-4">
      <input type="hidden" name="has_extras" value="1" />
      <AvatarPicker initial={profile.game_avatar ?? null} discordAvatar={profile.avatar_url} />
      <label className="block space-y-1">
        <span className="text-sm font-medium">In-game name</span>
        <input name="ign" onBlur={saveIfChanged} defaultValue={profile.ign ?? ""} maxLength={40} className={input} />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium">Friend code</span>
        <input
          name="friend_code" onBlur={saveIfChanged}
          defaultValue={profile.friend_code ? formatFriendCode(profile.friend_code) : ""}
          inputMode="numeric"
          placeholder="1234 5678 9012"
          className={`${input} font-mono`}
        />
        <span className="text-xs text-slate-500">You won't show up in other people's matches until this is set.</span>
      </label>
      <label className="block space-y-1">
        <span className="flex items-center gap-1 text-sm font-medium">
          <RedditIcon /> Reddit name <span className="font-normal text-slate-500">(optional)</span>
        </span>
        <div className="flex items-center gap-1">
          <span className="text-sm text-slate-500">u/</span>
          <input name="reddit_username" onBlur={saveIfChanged} defaultValue={profile.reddit_username ?? ""} maxLength={22} placeholder="your_reddit_name" className={input} />
        </div>
        <span className="text-xs text-slate-500">Shown under your name so Reddit friends recognize you. Not verified.</span>
      </label>
      <label className="flex items-start gap-3">
        <input type="checkbox" onChange={save} name="open_to_friends" defaultChecked={profile.open_to_friends} className="mt-1 h-4 w-4" />
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
          <input type="checkbox" onChange={save} name="show_discord" defaultChecked={profile.show_discord} className="mt-1 h-4 w-4" />
          <span>
            <span className="flex items-center gap-1 text-sm font-medium"><DiscordIcon /> Show my Discord name</span>
            <span className="text-xs text-slate-500">
              Off: other players see your IGN instead of @{profile.discord_username} and your Discord picture, and can only
              find you by IGN or friend code.
            </span>
          </span>
        </label>
      )}
      <label className="flex items-start gap-3">
        <input type="checkbox" onChange={save} name="votes_private" defaultChecked={profile.votes_private ?? false} className="mt-1 h-4 w-4" />
        <span>
          <span className="block text-sm font-medium">Friends-only votes</span>
          <span className="text-xs text-slate-500">
            Only players on your friend list see your wants, don&apos;t-wants and Top 3. Others still see your match %s.
          </span>
        </span>
      </label>
      <label className="flex items-start gap-3">
        <input type="checkbox" onChange={save} name="allow_lookup" defaultChecked={profile.allow_lookup} className="mt-1 h-4 w-4" />
        <span>
          <span className="block text-sm font-medium">Let people look me up</span>
          <span className="text-xs text-slate-500">
            Anyone who searches your IGN or friend code{profile.discord_username && profile.show_discord ? " (or Discord name)" : ""}{" "}
            can see your candy list.
          </span>
        </span>
      </label>
      <p className="min-h-5 text-sm" aria-live="polite">
        {pending ? (
          <span className="text-slate-500">Saving…</span>
        ) : state.error ? (
          <span role="alert" className="text-dont">{state.error}</span>
        ) : state.saved ? (
          <span className="text-want">Saved</span>
        ) : (
          <span className="text-slate-500">Changes save automatically.</span>
        )}
      </p>
    </form>
  );
}
