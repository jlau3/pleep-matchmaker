"use client";

import { useActionState, useRef } from "react";
import { type ProfileFormState, updateProfile } from "@/app/actions";
import { formatFriendCode } from "@/lib/format";
import type { OwnProfile } from "@/lib/types";
import { AvatarPicker } from "./AvatarPicker";
import { DiscordIcon, RedditIcon } from "./BrandIcons";

/** A settings switch: title and one line on the left, the switch on the right; `detail` is the fine print. */
function Toggle({
  name,
  defaultChecked,
  onChange,
  title,
  children,
  detail,
}: {
  name: string;
  defaultChecked: boolean;
  onChange: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  detail?: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-3">
      <span className="min-w-0">
        <span className="flex items-center gap-1 text-sm font-semibold">{title}</span>
        <span className="block text-sm text-slate-600 dark:text-slate-300">{children}</span>
        {detail && <span className="mt-0.5 block text-xs text-slate-500">{detail}</span>}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input type="checkbox" role="switch" name={name} defaultChecked={defaultChecked} onChange={onChange} className="peer sr-only" />
        <span className="h-6 w-11 rounded-full bg-slate-300 transition-colors peer-checked:bg-want peer-focus-visible:ring-2 peer-focus-visible:ring-night dark:bg-slate-600" />
        <span className="pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

const card = "card space-y-4 p-5";

/**
 * Your details and privacy, as two cards side by side on wide screens. No Save
 * button: switches save on click, text fields when you leave them (or press
 * Enter), the icon from its popup.
 */
export function ProfileForm({ profile, friendListFull }: { profile: OwnProfile; friendListFull: boolean }) {
  const [state, action, pending] = useActionState<ProfileFormState, FormData>(updateProfile, {});
  const form = useRef<HTMLFormElement>(null);
  const save = () => form.current?.requestSubmit();
  const saveIfChanged = (e: React.FocusEvent<HTMLInputElement>) => {
    if (e.currentTarget.value !== e.currentTarget.defaultValue) save();
  };
  const hint = "block text-xs text-slate-500";
  const status = (
    <span className="text-xs" aria-live="polite">
      {pending ? (
        <span className="text-slate-500">Saving…</span>
      ) : state.error ? (
        <span role="alert" className="text-dont">{state.error}</span>
      ) : state.saved ? (
        <span className="font-semibold text-want">Saved</span>
      ) : (
        <span className="text-slate-500">Saves automatically</span>
      )}
    </span>
  );
  return (
    <form ref={form} action={action} className="grid items-start gap-6 md:grid-cols-2">
      <input type="hidden" name="has_extras" value="1" />
      <section className={card} aria-labelledby="profile-details">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="profile-details" className="text-lg font-bold">Your profile</h2>
          {status}
        </div>
        <AvatarPicker initial={profile.game_avatar ?? null} discordAvatar={profile.avatar_url} />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-sm font-semibold">In-game name</span>
            <input name="ign" onBlur={saveIfChanged} defaultValue={profile.ign ?? ""} maxLength={40} placeholder="Exactly as in Pokémon Sleep" className="field" />
            <span className={hint}>Spelled exactly as in the game, so friends can find you.</span>
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-semibold">Friend code</span>
            <input
              name="friend_code"
              onBlur={saveIfChanged}
              defaultValue={profile.friend_code ? formatFriendCode(profile.friend_code) : ""}
              inputMode="numeric"
              placeholder="1234 5678 9012"
              className="field font-mono"
            />
            <span className={hint}>Needed to show up in Find New and to send requests.</span>
          </label>
        </div>
        <label className="block space-y-1">
          <span className="flex items-center gap-1 text-sm font-semibold">
            <RedditIcon /> Reddit name <span className="font-normal text-slate-500">(optional)</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="text-sm text-slate-500">u/</span>
            <input name="reddit_username" onBlur={saveIfChanged} defaultValue={profile.reddit_username ?? ""} maxLength={22} placeholder="your_reddit_name" className="field" />
          </span>
          <span className={hint}>Shown under your name so Reddit friends recognize you. Not verified.</span>
        </label>
      </section>

      <section className={card} aria-labelledby="profile-privacy">
        <h2 id="profile-privacy" className="text-lg font-bold">Privacy</h2>
        <div className="divide-y divide-slate-200 dark:divide-slate-700">
          <Toggle
            name="open_to_friends"
            defaultChecked={profile.open_to_friends}
            onChange={save}
            title="Show me in Find New"
            detail={
              friendListFull
                ? "Your friend list is full, so you're hidden until you remove someone. Off also hides your friend code from name searches."
                : "Hidden automatically while your friend list is full. Off also hides your friend code from name searches."
            }
          >
            Other players can see you as a suggested match.
          </Toggle>
          <Toggle
            name="allow_lookup"
            defaultChecked={profile.allow_lookup}
            onChange={save}
            title="Findable by search"
            detail="Off also takes your votes off your friends' Tier Lists, and they see your list as private."
          >
            People can find you by searching your exact IGN or friend code
            {profile.discord_username && profile.show_discord ? " (or Discord name)" : ""}.
          </Toggle>
          <Toggle name="votes_private" defaultChecked={profile.votes_private ?? false} onChange={save} title="Friends-only votes">
            Only friends see your wants and Top 3. Others still see your match %s.
          </Toggle>
          {profile.discord_username && (
            <>
              <input type="hidden" name="has_show_discord" value="1" />
              <Toggle
                name="show_discord"
                defaultChecked={profile.show_discord}
                onChange={save}
                title={
                  <>
                    <DiscordIcon /> Show Discord name
                  </>
                }
              >
                Show @{profile.discord_username} and your Discord picture. Off: you&apos;re shown by IGN only.
              </Toggle>
            </>
          )}
        </div>
      </section>
    </form>
  );
}
