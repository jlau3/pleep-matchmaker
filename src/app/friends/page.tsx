import Link from "next/link";
import { FriendAction } from "@/components/FriendAction";
import { PlayerHeader, playerName } from "@/components/PlayerHeader";
import { PlayerLists } from "@/components/PlayerLists";
import { FriendPostCard } from "@/components/FriendPostCard";
import { friendPostProps } from "@/lib/friendPost";
import { FitPair } from "@/components/FitPair";
import { PlayerSearch, searchQuery } from "@/components/PlayerSearch";
import { FRIENDS_TABS, SubTabs } from "@/components/SubTabs";
import { loadOwnProfile, loadOwnVotes, loadRelations, MAX_FRIENDS } from "@/lib/data";
import { requireUser } from "@/lib/supabase/server";
import type { FriendRow, PlaceholderRow, RequestRow, SentRequestRow } from "@/lib/types";
import { FriendPlaceholders } from "@/components/FriendPlaceholders";
import { type FriendItem, FriendsBoard } from "@/components/FriendsBoard";
import { FRIEND_SORTS, friendRank, parseFriendSort } from "@/lib/friendSort";
import { withExtras } from "@/lib/extras";
import { nameMatch } from "@/lib/names";
import { FitWithTop3 } from "@/components/Top3Tiers";
import { loadTop3Tiers } from "@/lib/top3Tiers";

const card = "card p-4";

export default async function FriendsPage({ searchParams }: { searchParams: Promise<{ q?: string; sort?: string }> }) {
  const { supabase, user } = await requireUser();
  const params = await searchParams;
  const q = await searchQuery(Promise.resolve(params));
  const sort = parseFriendSort(params.sort);

  const [friendsResult, requestsResult, sentResult, placeholdersResult, relations, profile, { choices, tops }] =
    await Promise.all([
      supabase.rpc("get_friends"),
      supabase.rpc("get_friend_requests", { with_fit: true }),
      supabase.rpc("get_sent_requests"),
      supabase.rpc("get_friend_placeholders"),
      loadRelations(supabase, user.id),
      loadOwnProfile(supabase, user.id),
      loadOwnVotes(supabase, user.id),
    ]);
  if (friendsResult.error) throw friendsResult.error;
  // Requests to you, and yours (empty if the friend_requests migration hasn't run yet).
  const requests = await withExtras(supabase, (requestsResult.data ?? []) as RequestRow[]);
  const sent = await withExtras(supabase, (sentResult.data ?? []) as SentRequestRow[]);
  // In-game friends not here yet (null until that migration runs, which hides the section).
  const placeholders = placeholdersResult.error ? null : ((placeholdersResult.data ?? []) as PlaceholderRow[]);
  const friends = await withExtras(supabase, friendsResult.data as FriendRow[]);
  // Where your Top 3 sits on each friend's Tier List (nothing to show without a Top 3).
  const top3 = tops.length > 0 ? await loadTop3Tiers(supabase, friends.map((f) => f.user_id)) : {};
  // A request from someone with a Not here yet name is probably that friend: those go first, in gold. Having
  // asked you is strong evidence on its own, so a close name counts here too (worded as a question).
  const placeholderFor = (ign: string | null): { name: string; strong: boolean } | null => {
    let close: string | null = null;
    for (const p of placeholders ?? []) {
      const match = nameMatch(p.name, ign);
      if (match === "strong") return { name: p.name, strong: true };
      if (match === "close") close ??= p.name;
    }
    return close ? { name: close, strong: false } : null;
  };
  const rank = (ign: string | null) => {
    const m = placeholderFor(ign);
    return m ? (m.strong ? 2 : 1) : 0;
  };
  const requestsSorted = [...requests].sort((a, b) => rank(b.ign) - rank(a.ign));
  // Declined, then expired, then open: the first two need a tap from you.
  const sentOrder = { declined: 0, expired: 1, open: 2 };
  const sentSorted = [...sent].sort((a, b) => sentOrder[a.status] - sentOrder[b.status]);
  const declined = sent.filter((r) => r.status === "declined").length;
  const expired = sent.filter((r) => r.status === "expired").length;

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <SubTabs tabs={FRIENDS_TABS} active="/friends" />
        <PlayerSearch supabase={supabase} q={q} relations={relations} viewerId={user.id} />
      </section>

      <FriendPostCard {...friendPostProps(profile, choices, tops)} />

      {requests.length > 0 && (
        <section id="requests" className="scroll-mt-20">
          <h2 className="mb-1 text-lg font-semibold">
            Friend requests <span className="text-sm font-normal text-slate-500">{requests.length}</span>
          </h2>
          <p className="mb-3 text-sm text-slate-500">
            These players want to be friends here and in Pokémon Sleep. Add them in the game with the friend code on
            their card first, then accept: the code goes away once you&apos;re friends, as in the game.
          </p>
          <ul className="space-y-3">
            {requestsSorted.map((player) => {
              const maybe = placeholderFor(player.ign);
              return (
                <li key={player.user_id} className={maybe ? `${card} ring-2 ring-sun-deep` : card}>
                  {maybe && (
                    <p className="-mx-4 -mt-4 mb-3 rounded-t-3xl bg-sun/40 px-4 py-2 text-sm dark:bg-sun/20">
                      {maybe.strong ? (
                        <b>★ This may be {maybe.name} from your Not here yet list!</b>
                      ) : (
                        <b>★ Could this be {maybe.name} from your Not here yet list?</b>
                      )}{" "}
                      {maybe.strong ? "If it's them" : "The names are close; check their icon. If it's them"}, accept; you
                      can then take the name off that list.
                    </p>
                  )}
                  <PlayerHeader
                    player={player}
                    relation={relations.profileReady ? "incoming" : "incoming-setup"}
                    placeholder={maybe?.name}
                    aside={<FitPair they={player.match_pct} you={player.you_fit_pct} />}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {sent.length > 0 && (
        // Folded like Not here yet: each card is tall, and setting up can mean dozens of requests.
        <details id="sent" className="card group scroll-mt-20 p-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <span>
              <span className="font-semibold">Sent requests</span> <span className="text-sm text-slate-500">{sent.length}</span>
              {declined > 0 && <span className="ml-2 text-xs font-semibold text-dont">{declined} declined</span>}
              {expired > 0 && <span className="ml-2 text-xs font-semibold text-slate-500">{expired} expired</span>}
              <span className="block text-sm text-slate-500">Waiting for these players to accept.</span>
            </span>
            <span className="shrink-0 text-xs font-semibold underline group-open:hidden">Show</span>
            <span className="hidden shrink-0 text-xs font-semibold underline group-open:inline">Hide</span>
          </summary>
          <p className="mb-3 mt-3 text-sm text-slate-500">
            Send them a request in Pokémon Sleep too. A request not answered in 30 days expires and stays here until you
            send it again or clear it.
          </p>
          <ul className="space-y-3">
            {sentSorted.map((player) => (
              <li key={player.user_id} className="rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
                <PlayerHeader player={player} relation={player.status === "open" ? "sent" : player.status} />
              </li>
            ))}
          </ul>
        </details>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">
          My Friends{" "}
          <span className="text-sm font-normal text-slate-500">
            {friends.length} / {MAX_FRIENDS}
          </span>
        </h2>
        {friends.length === 0 && (
          <p className="mb-3 text-sm text-slate-500">
            <strong>No friends yet?</strong> Search above for your Pokémon Sleep friends,{" "}
            <Link href="/matches" className="font-semibold underline">find new friends</Link>, or share your friend code.
          </p>
        )}
        {placeholders && (
          <div id="not-here-yet" className="mb-3 scroll-mt-20">
            <FriendPlaceholders rows={placeholders} relations={relations} viewerId={user.id} />
          </div>
        )}
        {friends.length > 0 && (
          <FriendsBoard
            initialSort={sort}
            // "For them" scores against your friends' votes (group_demand: visible friends' wants).
            friendsVoted={friends.some((f) => f.visible && f.wants.length > 0)}
            items={friends.map(
              (friend): FriendItem => ({
                id: friend.user_id,
                ranks: Object.fromEntries(FRIEND_SORTS.map(([id]) => [id, friendRank(friend, id, top3[friend.user_id])])) as FriendItem["ranks"],
                card: friend.visible ? (
                  <>
                    <PlayerHeader
                      player={friend}
                      relation="friend"
                      aside={
                        <FitWithTop3 they={friend.match_pct} you={friend.you_fit_pct} tops={tops} tiers={top3[friend.user_id]} />
                      }
                    />
                    <PlayerLists wants={friend.wants} dontWants={friend.dont_wants} topWants={friend.top_wants} />
                  </>
                ) : (
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span>
                      <strong>{playerName(friend)}</strong>
                      <span className="ml-2 text-slate-500">has made their list private</span>
                    </span>
                    <FriendAction userId={friend.user_id} name={playerName(friend)} relation="friend" />
                  </div>
                ),
              }),
            )}
          />
        )}
      </section>
    </div>
  );
}
