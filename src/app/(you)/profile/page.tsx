import { cookies } from "next/headers";
import { signOut } from "@/app/actions";
import { ThemePicker } from "@/components/ThemePicker";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";
import { BlockButton } from "@/components/BlockButton";
import { DeleteAccountButton } from "@/components/DeleteAccountButton";
import { playerAvatar, playerName } from "@/components/PlayerHeader";
import { ProfileForm } from "@/components/ProfileForm";
import { linkErrorText, SignInMethods } from "@/components/SignInMethods";
import { loadFriendIds, loadOwnProfile, MAX_FRIENDS } from "@/lib/data";
import { relativeTime } from "@/lib/format";
import { requireUser } from "@/lib/supabase/server";
import type { BlockedRow } from "@/lib/types";
import { SETUP_NEXT_COOKIE, safeNextPath } from "@/lib/nextPath";

const card = "card p-5";

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ error?: string; linked?: string; setup?: string; next?: string }> }) {
  const { supabase, user } = await requireUser();
  const [profile, friendIds, blockedResult, identitiesResult] = await Promise.all([
    loadOwnProfile(supabase, user.id),
    loadFriendIds(supabase, user.id),
    supabase.rpc("get_blocked"),
    supabase.auth.getUserIdentities(),
  ]);
  if (blockedResult.error) throw blockedResult.error;
  const blocked = blockedResult.data as BlockedRow[];
  const linkedProviders = (identitiesResult.data?.identities ?? []).map((i) => i.provider);
  const { error, linked, setup, next } = await searchParams;
  const continueTo = safeNextPath((await cookies()).get(SETUP_NEXT_COOKIE)?.value) ?? safeNextPath(next);
  const errorText = error ? linkErrorText(error) : null;
  const linkNotice = errorText
    ? { tone: "error" as const, text: errorText }
    : linked === "discord"
      ? { tone: "ok" as const, text: "Discord linked. Your Discord name now shows to your friends; you can hide it under Privacy." }
      : linked === "google"
        ? { tone: "ok" as const, text: "Google linked. You can now sign in with either." }
        : linked === "removed"
          ? { tone: "ok" as const, text: "Sign-in method removed." }
          : null;
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <div>
      <div className="space-y-6">
        <section className="flex items-center gap-3">
          <img src={playerAvatar(profile)} alt="" className="h-14 w-14 rounded-full bg-sky object-contain dark:bg-night-deep" />
          <div>
            <h1 className="text-xl font-bold">{playerName(profile)}</h1>
            {profile.discord_username && <p className="text-sm text-slate-500">@{profile.discord_username}</p>}
            <p className="text-xs text-slate-500">Votes updated {relativeTime(profile.prefs_updated_at)}</p>
          </div>
        </section>

        <ProfileForm profile={profile} friendListFull={friendIds.size >= MAX_FRIENDS} guideRequested={setup === "profile"} continueTo={continueTo} />

        <div className="grid items-start gap-6 md:grid-cols-2">
          <div className={card}>
            <SignInMethods linked={linkedProviders} discordName={profile.discord_username} notice={linkNotice} />
          </div>
          <div className="space-y-6">
            <section className={card}>
              <h2 className="mb-2 font-semibold">Theme</h2>
              <ThemePicker initial={theme} />
              <p className="mt-1 text-xs text-slate-500">Saved on this device.</p>
            </section>

            <section className={card}>
              <h2 className="mb-2 font-semibold">Blocked Players</h2>
              {blocked.length === 0 ? (
                <p className="text-sm text-slate-500">No one.</p>
              ) : (
                <ul className="space-y-2">
                  {blocked.map((row) => (
                    <li key={row.user_id} className="flex items-center justify-between text-sm">
                      <span>
                        {playerName(row)}
                        {row.discord_username && <span className="ml-2 text-slate-500">@{row.discord_username}</span>}
                      </span>
                      <BlockButton userId={row.user_id} name={playerName(row)} blocked />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>

        <section className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-6 dark:border-slate-800">
          <form action={signOut}>
            <button type="submit" className="rounded-lg border border-slate-300 px-4 py-2 font-semibold dark:border-slate-700">
              Sign out
            </button>
          </form>
          <DeleteAccountButton />
          {error === "delete" && <p className="w-full text-sm text-dont">Couldn't delete your account. Try again.</p>}
        </section>
      </div>
    </div>
  );
}
