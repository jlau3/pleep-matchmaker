"use client";

import { useActionState, useRef, useState } from "react";
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

type Visibility = "everyone" | "known" | "friends";

/** "Who can find you": each option sets search (allow_lookup) and Find New (open_to_friends) together. */
const VISIBILITY: { value: Visibility; title: string; text: string }[] = [
  { value: "everyone", title: "Everyone", text: "Suggested to good matches in Find New, and findable by your exact IGN or friend code." },
  { value: "known", title: "People who know me", text: "Only found by searching your exact IGN or friend code." },
  {
    value: "friends",
    title: "Only my friends",
    text: "Hidden from everyone who isn't already a friend. People you send a request to still see your card.",
  },
];

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
  const initialVisibility: Visibility = !profile.allow_lookup ? "friends" : profile.open_to_friends ? "everyone" : "known";
  // Tracked so the friend code switch shows only under Everyone.
  const [visibility, setVisibility] = useState<Visibility>(initialVisibility);
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
          <span className={hint}>Shown to your friends under your name. Not verified.</span>
        </label>
      </section>

      <section className={card} aria-labelledby="profile-privacy">
        <div>
          <h2 id="profile-privacy" className="text-lg font-bold">Privacy</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            <b>Your votes are only shown to friends.</b> Everyone else sees match %s.
          </p>
        </div>
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-semibold">Who can find you</legend>
          {VISIBILITY.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-start gap-3 rounded-2xl border-2 border-transparent bg-white px-3 py-2 has-[:checked]:border-night dark:bg-night-deep dark:has-[:checked]:border-sun"
            >
              <input
                type="radio"
                name="visibility"
                value={option.value}
                defaultChecked={initialVisibility === option.value}
                onChange={() => {
                  setVisibility(option.value);
                  save();
                }}
                className="mt-1 h-4 w-4 accent-[var(--color-night)]"
              />
              <span>
                <span className="block text-sm font-semibold">{option.title}</span>
                <span className="block text-sm text-slate-600 dark:text-slate-300">{option.text}</span>
                {option.value === "everyone" && friendListFull && (
                  <span className="block text-xs text-slate-500">Your friend list is full, so you&apos;re not suggested until you remove someone.</span>
                )}
              </span>
            </label>
          ))}
        </fieldset>
        {visibility === "everyone" && profile.share_code !== undefined && (
          <div className="border-t border-slate-200 dark:border-slate-700">
            <input type="hidden" name="has_share_code" value="1" />
            <Toggle
              name="share_code"
              defaultChecked={profile.share_code}
              onChange={save}
              title="Show my friend code before we're friends"
              detail="Off: they see your IGN and icon. Their friend request shows you their code, so you add them in Pokémon Sleep once you accept. Friends always see your code."
            >
              Players who find you in Find New or by your IGN can add you in Pokémon Sleep straight away.
            </Toggle>
          </div>
        )}
        {profile.discord_username && (
          <div className="border-t border-slate-200 dark:border-slate-700">
            <input type="hidden" name="has_show_discord" value="1" />
            <Toggle
              name="show_discord"
              defaultChecked={profile.show_discord}
              onChange={save}
              title={
                <>
                  <DiscordIcon /> Show my Discord name to friends
                </>
              }
              detail="Other players never see it or find you by it, except people you send a friend request to."
            >
              Friends see @{profile.discord_username} and your Discord picture on your card.
            </Toggle>
          </div>
        )}
        {profile.reddit_username && profile.show_reddit !== undefined && (
          <div className="border-t border-slate-200 dark:border-slate-700">
            <input type="hidden" name="has_show_reddit" value="1" />
            <Toggle
              name="show_reddit"
              defaultChecked={profile.show_reddit}
              onChange={save}
              title={
                <>
                  <RedditIcon /> Show my Reddit name to friends
                </>
              }
              detail="Other players never see it."
            >
              Friends see u/{profile.reddit_username} under your name.
            </Toggle>
          </div>
        )}
      </section>
    </form>
  );
}
