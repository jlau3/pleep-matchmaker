import Link from "next/link";
import { LineChips } from "@/components/LineChips";
import { PlayerHeader } from "@/components/PlayerHeader";
import { loadFriendIds, loadOwnChoices, loadOwnProfile } from "@/lib/data";
import { LINES, linesFromIds } from "@/lib/lines";
import { requireUser } from "@/lib/supabase/server";
import type { MatchRow } from "@/lib/types";

export default async function MatchesPage() {
  const { supabase, user } = await requireUser();
  const [choices, profile, friendIds, matchesResult] = await Promise.all([
    loadOwnChoices(supabase, user.id),
    loadOwnProfile(supabase, user.id),
    loadFriendIds(supabase, user.id),
    supabase.rpc("get_matches"),
  ]);
  if (matchesResult.error) throw matchesResult.error;
  const matches = matchesResult.data as MatchRow[];

  const picked = Object.values(choices).filter((c) => c !== "undecided").length;
  const unsorted = LINES.length - Object.keys(choices).length;

  const notices: React.ReactNode[] = [];
  if (!profile.friend_code)
    notices.push(
      <>
        Add your friend code in <Link href="/profile" className="underline">Profile</Link> so others can find you.
      </>,
    );
  if (!profile.open_to_friends)
    notices.push(
      <>
        You're hidden from other people's matches. Turn on "Open to new friends" in{" "}
        <Link href="/profile" className="underline">Profile</Link> when you have room.
      </>,
    );
  if (unsorted > 0 && picked > 0)
    notices.push(
      <>
        {unsorted} {unsorted === 1 ? "line isn't" : "lines aren't"} sorted yet.{" "}
        <Link href="/vote" className="underline">Vote on them</Link>
      </>,
    );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Matchmake</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Players open to new friends whose candy list lines up with yours.
        </p>
      </div>
      {notices.map((notice, i) => (
        <p key={i} className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
          {notice}
        </p>
      ))}

      {picked === 0 ? (
        <p className="py-8 text-center text-slate-500">
          Mark some lines as want or don't want first. <Link href="/vote" className="underline">Start voting</Link>
        </p>
      ) : matches.length === 0 ? (
        <p className="py-8 text-center text-slate-500">
          No matches yet. A match needs at least 25% and 3 lines you both want. Check back as more players join.
        </p>
      ) : (
        <ul className="space-y-4">
          {matches.map((match) => (
            <li key={match.user_id} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <PlayerHeader
                player={match}
                isFriend={friendIds.has(match.user_id)}
                aside={<div className="shrink-0 text-right text-3xl font-bold text-want">{match.match_pct}%</div>}
              />
              <div className="mt-4">
                <h3 className="mb-2 text-sm font-semibold">You both want ({match.shared_wants.length})</h3>
                <LineChips lines={linesFromIds(match.shared_wants)} />
              </div>
              {match.shared_dont_wants.length > 0 && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-semibold text-slate-500">
                    You both don't want ({match.shared_dont_wants.length})
                  </summary>
                  <div className="mt-2">
                    <LineChips lines={linesFromIds(match.shared_dont_wants)} />
                  </div>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
