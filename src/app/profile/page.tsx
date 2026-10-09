import { signOut, unblockUser } from "@/app/actions";
import { DeleteAccountButton } from "@/components/DeleteAccountButton";
import { playerName } from "@/components/PlayerHeader";
import { ProfileForm } from "@/components/ProfileForm";
import { loadOwnProfile } from "@/lib/data";
import { relativeTime } from "@/lib/format";
import { requireUser } from "@/lib/supabase/server";
import type { BlockedRow } from "@/lib/types";

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { supabase, user } = await requireUser();
  const [profile, blockedResult] = await Promise.all([loadOwnProfile(supabase, user.id), supabase.rpc("get_blocked")]);
  if (blockedResult.error) throw blockedResult.error;
  const blocked = blockedResult.data as BlockedRow[];
  const { error } = await searchParams;

  return (
    <div className="mx-auto max-w-md space-y-8">
      <section className="flex items-center gap-3">
        {profile.avatar_url && <img src={profile.avatar_url} alt="" className="h-14 w-14 rounded-full" />}
        <div>
          <h1 className="text-xl font-bold">{playerName(profile)}</h1>
          {profile.discord_username && <p className="text-sm text-slate-500">@{profile.discord_username}</p>}
          <p className="text-xs text-slate-500">Prefs updated {relativeTime(profile.prefs_updated_at)}</p>
        </div>
      </section>

      <ProfileForm profile={profile} />

      <section>
        <h2 className="mb-2 font-semibold">Blocked players</h2>
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
                <form action={unblockUser.bind(null, row.user_id)}>
                  <button type="submit" className="text-xs underline">
                    Unblock
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

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
  );
}
