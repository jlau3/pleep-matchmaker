import Link from "next/link";
import { FriendSetupBanner } from "@/components/FriendSetupBanner";
import { FindNewBoard } from "@/components/FindNewBoard";
import { loadTop3Tiers, type Top3Tiers } from "@/lib/top3Tiers";
import { PlayerSearch, searchQuery } from "@/components/PlayerSearch";
import { FriendPostCard } from "@/components/FriendPostCard";
import { friendPostProps } from "@/lib/friendPost";
import { FriendshipLevel5 } from "@/components/FriendshipLevel5";
import { loadOwnProfile, loadOwnVotes, loadRelations, MAX_FRIENDS } from "@/lib/data";
import { LINES } from "@/lib/lines";
import { BROWSE_PAGE_SIZE, parseBrowse, matchesBrowseFilters, sortPlayers } from "@/lib/browse";
import { loadCandidates } from "@/lib/loadCandidates";
import { requireUser } from "@/lib/supabase/server";
import type { HiddenSuggestion } from "@/lib/types";

type Params = { q?: string; sort?: string; show?: string; active?: string; friends?: string; spotlight?: string; joined?: string; declined?: string; page?: string };

export default async function MatchesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { supabase, user } = await requireUser();
  const params = await searchParams;
  const q = await searchQuery(Promise.resolve(params));
  const opts = parseBrowse(params);
  const [{ choices, tops }, profile, relations, votedResult, rows, hiddenResult] = await Promise.all([
    loadOwnVotes(supabase, user.id),
    loadOwnProfile(supabase, user.id),
    loadRelations(supabase, user.id),
    supabase.rpc("my_friends_voted"),
    loadCandidates(supabase),
    supabase.rpc("get_hidden_suggestions"),
  ]);
  if (hiddenResult.error) throw hiddenResult.error;
  const hiddenPlayers = (hiddenResult.data ?? []) as HiddenSuggestion[];
  const hiddenIds = hiddenPlayers.map((r) => r.user_id);
  const hidden = new Set(hiddenIds);
  // Your Top 3's tiers: everyone's when the page opens sorted by them, else the first page's
  // (FindNewBoard fetches the rest in the background).
  let tiers: Top3Tiers = {};
  let allTiers = tops.length === 0 || rows.length === 0;
  if (tops.length > 0 && rows.length > 0) {
    if (opts.sort === "top3" || opts.spotlightSafe) {
      try {
        tiers = await loadTop3Tiers(supabase, rows.map((r) => r.user_id), true);
        allTiers = true;
      } catch {
        // The client retries and explains a failed filter load instead of treating unknown tiers as matches.
      }
    } else {
      const pool = rows.filter((r) => !hidden.has(r.user_id) && matchesBrowseFilters(r, opts));
      const first = sortPlayers(pool, opts.sort).slice((opts.page - 1) * BROWSE_PAGE_SIZE, opts.page * BROWSE_PAGE_SIZE);
      const loaded = await loadTop3Tiers(supabase, first.map((r) => r.user_id));
      // Known for every first-page player: no entry means all dashes.
      tiers = Object.fromEntries(first.map((r) => [r.user_id, loaded[r.user_id] ?? {}]));
    }
  }
  // "For them" is a dash until a friend has voted (assume they have if the check isn't deployed yet).
  const friendsVoted = votedResult.error ? true : Boolean(votedResult.data);

  const picked = Object.keys(choices).length;
  const unsorted = LINES.length - Object.keys(choices).length;

  const notices: React.ReactNode[] = [];
  if (relations.friendIds.length >= MAX_FRIENDS)
    notices.push(
      <>
        Your friend list is full ({MAX_FRIENDS}/{MAX_FRIENDS}), so you're hidden from other people's matches.{" "}
        <Link href="/friends" className="underline">Remove someone</Link> to show up again.
      </>,
    );
  if (unsorted > 0 && picked > 0)
    notices.push(
      <>
        {unsorted} {unsorted === 1 ? "candy isn't" : "candies aren't"} sorted yet.{" "}
        <Link href="/vote" className="underline">Vote on them</Link>
      </>,
    );

  return (
    <div className="space-y-4">
      <div>
        <FriendSetupBanner profile={profile} />
        <PlayerSearch supabase={supabase} q={q} relations={relations} viewerId={user.id} />
        <div className="mt-4">
          <FriendPostCard {...friendPostProps(profile, choices, tops)} />
        </div>
      </div>
      {notices.map((notice, i) => (
        <p key={i} className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
          {notice}
        </p>
      ))}

      <FriendshipLevel5 />

      <FindNewBoard
        rows={relations.profileReady ? rows : []}
        initialHiddenIds={hiddenIds}
        hiddenPlayers={hiddenPlayers}
        autoOpenGuide={profile.match_guide_seen === false}
        relations={relations}
        tops={tops}
        initial={opts}
        initialTiers={tiers}
        allTiersLoaded={allTiers}
        q={q ?? ""}
        picked={picked}
        friendsVoted={friendsVoted}
      />
    </div>
  );
}
