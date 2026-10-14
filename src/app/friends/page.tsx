import Link from "next/link";
import { FriendButton } from "@/components/FriendButton";
import { PlayerHeader, playerName } from "@/components/PlayerHeader";
import { PlayerLists } from "@/components/PlayerLists";
import { FriendPostCard } from "@/components/FriendPostCard";
import { friendPostProps } from "@/lib/friendPost";
import { InviteReminder } from "@/components/InviteReminder";
import { FitPair } from "@/components/FitPair";
import { PlayerSearch, searchQuery } from "@/components/PlayerSearch";
import { FRIENDS_TABS, SubTabs } from "@/components/SubTabs";
import { loadOwnProfile, loadOwnVotes, MAX_FRIENDS } from "@/lib/data";
import { requireUser } from "@/lib/supabase/server";
import type { AddedMeRow, FriendRow, PendingRow, PlaceholderRow } from "@/lib/types";
import { FriendPlaceholders } from "@/components/FriendPlaceholders";
import { ConnectSteps } from "@/components/ConnectSteps";
import { DismissAddedYou } from "@/components/DismissAddedYou";
import { type FriendItem, FriendsBoard } from "@/components/FriendsBoard";
import { FRIEND_SORTS, friendRank, parseFriendSort } from "@/lib/friendSort";

const card = "card p-4";

export default async function FriendsPage({ searchParams }: { searchParams: Promise<{ q?: string; sort?: string }> }) {
  const { supabase, user } = await requireUser();
  const params = await searchParams;
  const q = await searchQuery(Promise.resolve(params));
  const sort = parseFriendSort(params.sort);

  const [friendsResult, addedMeResult, pendingResult, placeholdersResult, profile, { choices, tops }] = await Promise.all([
    supabase.rpc("get_friends"),
    supabase.rpc("get_added_me", { with_fit: true }),
    supabase.rpc("get_pending_friends"),
    supabase.rpc("get_friend_placeholders"),
    loadOwnProfile(supabase, user.id),
    loadOwnVotes(supabase, user.id),
  ]);
  if (friendsResult.error) throw friendsResult.error;
  // People who added you and are waiting on you (empty if that lookup isn't available yet).
  const addedMe = (addedMeResult.data ?? []) as AddedMeRow[];
  // Asked in Pokémon Sleep, not added here yet (empty until that migration runs).
  const pending = (pendingResult.data ?? []) as PendingRow[];
  // In-game friends not here yet (null until that migration runs, which hides the section).
  const placeholders = placeholdersResult.error ? null : ((placeholdersResult.data ?? []) as PlaceholderRow[]);
  const friends = friendsResult.data as FriendRow[];
  const friendIds = new Set(friends.map((f) => f.user_id));

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <SubTabs tabs={FRIENDS_TABS} active="/friends" />
        <PlayerSearch supabase={supabase} q={q} friendIds={friendIds} viewerId={user.id} />
      </section>

      {placeholders && (
        <section id="not-here-yet" className="scroll-mt-20">
          <FriendPlaceholders rows={placeholders} friendIds={[...friendIds]} viewerId={user.id} />
        </section>
      )}

      {addedMe.length > 0 && (
        <section id="added-you" className="scroll-mt-20">
          <h2 className="mb-1 text-lg font-semibold">
            Added you <span className="text-sm font-normal text-slate-500">{addedMe.length}</span>
          </h2>
          <p className="mb-3 text-sm text-slate-500">
            These players have you on their friend list here. Once you&apos;re friends in Pokémon Sleep too, add them
            back so their candy shows on your Tier List.
          </p>
          <ul className="space-y-3">
            {addedMe.map((player) => (
              <li key={player.user_id} className={card}>
                <PlayerHeader
                  player={player}
                  isFriend={false}
                  aside={<FitPair they={player.match_pct} you={player.you_fit_pct} />}
                  actions={<DismissAddedYou userId={player.user_id} />}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {pending.length > 0 && (
        <section id="pending" className="scroll-mt-20">
          <h2 className="mb-1 text-lg font-semibold">
            Pending in Pokémon Sleep <span className="text-sm font-normal text-slate-500">{pending.length}</span>
          </h2>
          <p className="mb-3 text-sm text-slate-500">
            You&apos;ve asked these players in the game. Add each one here once they accept.
          </p>
          <ul className="space-y-3">
            {pending.map((player) => (
              <li key={player.user_id} className={card}>
                <PlayerHeader player={player} />
                <div className="mt-3">
                  <ConnectSteps userId={player.user_id} name={playerName(player)} initialPending />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">
          My Friends{" "}
          <span className="text-sm font-normal text-slate-500">
            {friends.length} / {MAX_FRIENDS}
          </span>
        </h2>
        <div className="mb-3">
          <FriendPostCard {...friendPostProps(profile, choices, tops)} />
        </div>
        {friends.length < MAX_FRIENDS && (
          <div className="mb-3">
            <InviteReminder friendCount={friends.length} />
          </div>
        )}
        {friends.length === 0 ? (
          <p className="text-sm text-slate-500">
            Search for your Pokémon Sleep friends above and add them, or find new ones in{" "}
            <Link href="/matches" className="underline">Find New Friends</Link>. Then check the{" "}
            <Link href="/tiers" className="underline">Tier List</Link> to see which candy they want most.
          </p>
        ) : (
          <FriendsBoard
            initialSort={sort}
            // "For them" scores against your friends' votes (group_demand: visible friends' wants).
            friendsVoted={friends.some((f) => f.visible && f.wants.length > 0)}
            items={friends.map(
              (friend): FriendItem => ({
                id: friend.user_id,
                ranks: Object.fromEntries(FRIEND_SORTS.map(([id]) => [id, friendRank(friend, id)])) as FriendItem["ranks"],
                card: friend.visible ? (
                  <>
                    <PlayerHeader
                      player={friend}
                      isFriend
                      aside={<FitPair they={friend.match_pct} you={friend.you_fit_pct} />}
                    />
                    {friend.added_me && (
                      <p className="mt-1 text-xs font-semibold text-want" title="They have you on their friend list too">
                        ↔ Added you too
                      </p>
                    )}
                    <PlayerLists wants={friend.wants} dontWants={friend.dont_wants} topWants={friend.top_wants} />
                  </>
                ) : (
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span>
                      <strong>{playerName(friend)}</strong>
                      <span className="ml-2 text-slate-500">has made their list private</span>
                    </span>
                    <FriendButton userId={friend.user_id} isFriend name={playerName(friend)} />
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
