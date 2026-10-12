import Link from "next/link";
import { LineChips } from "@/components/LineChips";
import { PlayerHeader } from "@/components/PlayerHeader";
import { PlayerSearch, searchQuery } from "@/components/PlayerSearch";
import { FRIENDS_TABS, SubTabs } from "@/components/SubTabs";
import { FriendPostCard } from "@/components/FriendPostCard";
import { MatchPct } from "@/components/MatchPct";
import { LOW_FIT_PCT } from "@/lib/fit";
import { loadFriendIds, loadOwnProfile, loadOwnVotes, MAX_FRIENDS } from "@/lib/data";
import { LINES, LINES_BY_ID, linesFromIds } from "@/lib/lines";
import { requireUser } from "@/lib/supabase/server";
import type { MatchRow } from "@/lib/types";

export default async function MatchesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { supabase, user } = await requireUser();
  const q = await searchQuery(searchParams);
  const [{ choices, tops }, profile, friendIds, matchesResult] = await Promise.all([
    loadOwnVotes(supabase, user.id),
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
  if (friendIds.size >= MAX_FRIENDS)
    notices.push(
      <>
        Your friend list is full ({MAX_FRIENDS}/{MAX_FRIENDS}), so you're hidden from other people's matches.{" "}
        <Link href="/friends" className="underline">Remove someone</Link> to show up again.
      </>,
    );
  else if (!profile.open_to_friends)
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
        <SubTabs tabs={FRIENDS_TABS} active="/matches" query={q ? `q=${encodeURIComponent(q)}` : undefined} />
        <PlayerSearch supabase={supabase} q={q} friendIds={friendIds} viewerId={user.id} />
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
          Players open to new friends who want the same candy your friends want. Until your friends have voted, your
          own wants stand in.
        </p>
      </div>
      {notices.map((notice, i) => (
        <p key={i} className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
          {notice}
        </p>
      ))}

      <FriendPostCard
        friendCode={profile.friend_code}
        handle={profile.discord_username ? `@${profile.discord_username}` : profile.ign}
        searchName={profile.discord_username ?? profile.ign}
        topNames={linesFromIds(tops).map((line) => line.name)}
        wantNames={linesFromIds(Object.keys(choices).filter((id) => choices[id] === "want"))
          .sort((a, b) => b.weight - a.weight || a.dex - b.dex)
          .slice(0, 3)
          .map((line) => line.name)}
      />

      {picked === 0 && friendIds.size === 0 ? (
        <p className="py-8 text-center text-slate-500">
          Add your friends (or <Link href="/vote" className="underline">vote</Link> on some lines) so we know what your group
          wants.
        </p>
      ) : matches.length === 0 ? (
        <p className="py-8 text-center text-slate-500">
          No matches yet. A match needs at least {LOW_FIT_PCT}% fit and 3 lines your friends want. Check back as more
          players join.
        </p>
      ) : (
        <ul className="space-y-4">
          {matches.map((match) => (
            <li key={match.user_id} className="card p-4">
              <PlayerHeader
                player={match}
                isFriend={friendIds.has(match.user_id)}
                aside={<MatchPct pct={match.match_pct} />}
              />
              <div className="mt-4">
                <h3 className="mb-2 text-sm font-semibold">Wants what your friends want ({match.fit_wants.length})</h3>
                {/* Kept in the order Find New returns: most-wanted by your friends first. */}
                <LineChips lines={match.fit_wants.flatMap((id) => LINES_BY_ID.get(id) ?? [])} />
              </div>
              {match.fit_dont_wants.length > 0 && (
                <div className="mt-3">
                  <h3 className="mb-2 text-sm font-semibold text-dont">
                    Doesn&apos;t want, but your friends do ({match.fit_dont_wants.length})
                  </h3>
                  <LineChips lines={match.fit_dont_wants.flatMap((id) => LINES_BY_ID.get(id) ?? [])} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
