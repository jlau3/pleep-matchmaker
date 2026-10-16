import Link from "next/link";
import { FindNewBoard } from "@/components/FindNewBoard";
import { loadTop3Tiers, type Top3Tiers } from "@/lib/top3Tiers";
import { PlayerSearch, searchQuery } from "@/components/PlayerSearch";
import { FRIENDS_TABS, SubTabs } from "@/components/SubTabs";
import { FriendPostCard } from "@/components/FriendPostCard";
import { friendPostProps } from "@/lib/friendPost";
import { FriendshipLevel5 } from "@/components/FriendshipLevel5";
import { loadOwnProfile, loadOwnVotes, loadRelations, MAX_FRIENDS } from "@/lib/data";
import { LINES } from "@/lib/lines";
import { BROWSE_PAGE_SIZE, parseBrowse, sortPlayers } from "@/lib/browse";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireUser } from "@/lib/supabase/server";
import type { MatchRow } from "@/lib/types";
import { withExtras } from "@/lib/extras";

type Params = { q?: string; sort?: string; show?: string; page?: string };

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
    supabase.from("hidden_suggestions").select("hidden_user_id").eq("user_id", user.id),
  ]);
  if (hiddenResult.error) throw hiddenResult.error;
  const hiddenIds = (hiddenResult.data ?? []).map((r) => r.hidden_user_id as string);
  const hidden = new Set(hiddenIds);
  // Your Top 3's tiers: everyone's when the page opens sorted by them, else the first page's
  // (FindNewBoard fetches the rest in the background).
  let tiers: Top3Tiers = {};
  let allTiers = tops.length === 0;
  if (tops.length > 0 && rows.length > 0) {
    if (opts.sort === "top3") {
      tiers = await loadTop3Tiers(supabase, rows.map((r) => r.user_id));
      allTiers = true;
    } else {
      const pool = rows.filter((r) => !hidden.has(r.user_id) && (opts.everyone || r.good));
      const first = sortPlayers(pool, opts.sort).slice((opts.page - 1) * BROWSE_PAGE_SIZE, opts.page * BROWSE_PAGE_SIZE);
      const loaded = await loadTop3Tiers(supabase, first.map((r) => r.user_id));
      // Known for every first-page player: no entry means all dashes.
      tiers = Object.fromEntries(first.map((r) => [r.user_id, loaded[r.user_id] ?? {}]));
    }
  }
  // "For them" is a dash until a friend has voted (assume they have if the check isn't deployed yet).
  const friendsVoted = votedResult.error ? true : Boolean(votedResult.data);

  const picked = Object.values(choices).filter((c) => c !== "undecided").length;
  const unsorted = LINES.length - Object.keys(choices).length;

  const notices: React.ReactNode[] = [];
  // Other players only see your IGN (Discord names are friends-only), and Find New skips players without one.
  if (!profile.ign)
    notices.push(
      <>
        Add your in-game name in <Link href="/profile" className="underline">Profile</Link> so other players can recognize
        and find you. Until then you don&apos;t show up here.
      </>,
    );
  if (!profile.friend_code)
    notices.push(
      <>
        Add your friend code in <Link href="/profile" className="underline">Profile</Link> so others can find you.
      </>,
    );
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
        {unsorted} {unsorted === 1 ? "line isn't" : "lines aren't"} sorted yet.{" "}
        <Link href="/vote" className="underline">Vote on them</Link>
      </>,
    );

  return (
    <div className="space-y-4">
      <div>
        <SubTabs tabs={FRIENDS_TABS} active="/matches" />
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
        rows={rows}
        initialHiddenIds={hiddenIds}
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

/**
 * Everyone Find New could suggest, with their numbers (browse_all, up to 1000,
 * Best match first). Before 20261020000500_browse_all.sql: the first 50 of
 * Everyone and of Good matches from browse_players instead.
 */
async function loadCandidates(supabase: SupabaseClient): Promise<MatchRow[]> {
  const all = await supabase.rpc("browse_all");
  if (!all.error) return all.data as MatchRow[];
  const page = (everyone: boolean) =>
    supabase.rpc("browse_players", { sort: "fit", everyone, page_size: 50, page_offset: 0, line_count: LINES.length });
  const [everyone, good] = await Promise.all([page(true), page(false)]);
  if (everyone.error) throw everyone.error;
  const goodIds = new Set(((good.data ?? []) as MatchRow[]).map((r) => r.user_id));
  const rows = (everyone.data as MatchRow[]).map((r) => ({
    ...r,
    good: goodIds.has(r.user_id),
    both_pct: r.match_pct == null && r.you_fit_pct == null ? null : (r.match_pct ?? 0) + (r.you_fit_pct ?? 0),
  }));
  return withExtras(supabase, rows);
}
