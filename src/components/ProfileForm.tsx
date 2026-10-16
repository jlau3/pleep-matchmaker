"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { type ProfileFormState, updateProfile } from "@/app/actions";
import { rethrowIfNavigation, SAVE_FAILED } from "@/lib/saveError";
import { formatFriendCode } from "@/lib/format";
import type { OwnProfile } from "@/lib/types";
import { firstProfileGuideStep, profileGuideSteps } from "@/lib/profileGuide";
import { ProfileGuide } from "./ProfileGuide";
import { AvatarPicker } from "./AvatarPicker";
import { DiscordIcon, RedditIcon } from "./BrandIcons";

/** A settings switch: title and one line on the left, the switch on the right; `detail` is the fine print. */
function Toggle({
  name,
  checked,
  onChange,
  title,
  children,
  detail,
}: {
  name: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
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
        <input type="checkbox" role="switch" name={name} checked={checked} onChange={(event) => onChange(event.currentTarget.checked)} className="peer sr-only" />
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
  { value: "known", title: "People who know me", text: "Hidden from Find New. People can still find you by your exact IGN or friend code." },
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
export function ProfileForm({ profile, friendListFull, guideRequested = false, continueTo = null }: { profile: OwnProfile; friendListFull: boolean; guideRequested?: boolean; continueTo?: string | null }) {
  const [state, action, pending] = useActionState<ProfileFormState & { submission: number }, FormData>(async (previous, values) => {
    try {
      return { ...await updateProfile(previous, values), submission: previous.submission + 1 };
    } catch (error) {
      rethrowIfNavigation(error);
      return { error: SAVE_FAILED, submission: previous.submission + 1 };
    }
  }, { submission: 0 });
  const [guideOpen, setGuideOpen] = useState(false);
  const guideDismissedKey = `pm_profile_guide_dismissed:${profile.id}`;
  useEffect(() => {
    if (!guideRequested) return;
    try {
      if (sessionStorage.getItem(guideDismissedKey)) return;
    } catch { /* Storage is optional. */ }
    setGuideOpen(true);
  }, [guideRequested, guideDismissedKey]);
  useEffect(() => {
    const open = () => setGuideOpen(true);
    window.addEventListener("pm-profile-guide-open", open);
    return () => window.removeEventListener("pm-profile-guide-open", open);
  }, []);
  const closeGuide = () => {
    setGuideOpen(false);
    try { sessionStorage.setItem(guideDismissedKey, "1"); } catch { /* Storage is optional. */ }
  };
  const form = useRef<HTMLFormElement>(null);
  // Controlled fields survive failed saves and form-action resets.
  const [ign, setIgn] = useState(profile.ign ?? "");
  const [friendCode, setFriendCode] = useState(profile.friend_code ? formatFriendCode(profile.friend_code) : "");
  const [redditName, setRedditName] = useState(profile.reddit_username ?? "");
  const [showDiscord, setShowDiscord] = useState(profile.show_discord);
  const [showReddit, setShowReddit] = useState(profile.show_reddit ?? true);
  const save = () => form.current?.requestSubmit();
  const savedText: Record<string, string> = {
    ign: profile.ign ?? "",
    friend_code: profile.friend_code ? formatFriendCode(profile.friend_code) : "",
    reddit_username: profile.reddit_username ?? "",
  };
  const saveIfChanged = (e: React.FocusEvent<HTMLInputElement>) => {
    if (e.currentTarget.value !== savedText[e.currentTarget.name]) save();
  };
  const hint = "block text-xs text-slate-500";
  const [visibility, setVisibility] = useState<Visibility>(!profile.allow_lookup ? "friends" : profile.open_to_friends ? "everyone" : "known");
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
    <form
      ref={form}
      action={action}
      onSubmit={(event) => {
        event.preventDefault();
        // Dispatch without React's automatic form reset: it restores radios and
        // switches to their initial values, even when their state is controlled.
        const values = new FormData(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter);
        startTransition(() => action(values));
      }}
      className="grid items-start gap-6 md:grid-cols-2"
    >
      <input type="hidden" name="has_extras" value="1" />
      <section className={card} aria-labelledby="profile-details">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="profile-details" className="text-lg font-bold">Your profile</h2>
          {status}
        </div>
        <button type="button" onClick={() => setGuideOpen(true)} className="text-sm font-semibold underline">Show me what to fill in</button>
        <div id="profile-picture" data-profile-step="game_avatar">
          <AvatarPicker initial={profile.game_avatar ?? null} discordAvatar={profile.avatar_url} requiredForSetup={guideOpen} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label data-profile-step="ign" className="block space-y-1">
            <span className="text-sm font-semibold">In-game name</span>
            <input name="ign" onBlur={saveIfChanged} value={ign} onChange={(event) => setIgn(event.currentTarget.value)} maxLength={40} placeholder="Exactly as in Pokémon Sleep" className="field" />
            <span className={hint}>Spelled exactly as in the game, so friends can find you.</span>
          </label>
          <label data-profile-step="friend_code" className="block space-y-1">
            <span className="text-sm font-semibold">Friend code</span>
            <input
              name="friend_code"
              onBlur={saveIfChanged}
              value={friendCode}
              onChange={(event) => setFriendCode(event.currentTarget.value)}
              inputMode="numeric"
              placeholder="1234 5678 9012"
              className="field font-mono"
            />
            <span className={hint}>Find it in Research Community in Pokémon Sleep. Needed to search and add friends here.</span>
          </label>
        </div>
        <label className="block space-y-1">
          <span className="flex items-center gap-1 text-sm font-semibold">
            <RedditIcon /> Reddit name <span className="font-normal text-slate-500">(optional)</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="text-sm text-slate-500">u/</span>
            <input name="reddit_username" onBlur={saveIfChanged} value={redditName} onChange={(event) => setRedditName(event.currentTarget.value)} maxLength={22} placeholder="your_reddit_name" className="field" />
          </span>
          <span className={hint}>Shown to your friends under your name. Not verified.</span>
        </label>
      </section>

      <section className={card} aria-labelledby="profile-privacy">
        <div>
          <h2 id="profile-privacy" className="scroll-mt-20 text-lg font-bold">Privacy</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            <b>Your votes are only shown to friends.</b>
          </p>
        </div>
        <fieldset data-profile-step="visibility" className="space-y-2">
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
                checked={visibility === option.value}
                onChange={() => { setVisibility(option.value); save(); }}
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
        <div data-profile-step="sharing">
          {profile.discord_username && (
            <div className="border-t border-slate-200 dark:border-slate-700">
              <input type="hidden" name="has_show_discord" value="1" />
              <Toggle
                name="show_discord"
                checked={showDiscord}
                onChange={(value) => { setShowDiscord(value); save(); }}
                title={
                  <>
                    <DiscordIcon /> Show my Discord name to friends
                  </>
                }
                detail="Your chosen Pokémon picture stays the same."
              >
                Show @{profile.discord_username} under your name to friends and people you have a friend request with.
              </Toggle>
            </div>
          )}
          {profile.reddit_username && profile.show_reddit !== undefined && (
            <div className="border-t border-slate-200 dark:border-slate-700">
              <input type="hidden" name="has_show_reddit" value="1" />
              <Toggle
                name="show_reddit"
                checked={showReddit}
                onChange={(value) => { setShowReddit(value); save(); }}
                title={
                  <>
                    <RedditIcon /> Show my Reddit name to friends
                  </>
                }
                detail="People you send a pending friend request to can also see it. Other players cannot."
              >
                Friends see u/{profile.reddit_username} under your name.
              </Toggle>
            </div>
          )}
        </div>
      </section>
      {guideOpen && (
        <ProfileGuide
          form={form}
          steps={profileGuideSteps(Boolean(profile.discord_username || (profile.reddit_username && profile.show_reddit !== undefined)))}
          initialStep={firstProfileGuideStep(profile)}
          pending={pending}
          result={state}
          onClose={closeGuide}
          continueTo={continueTo}
        />
      )}
    </form>
  );
}
