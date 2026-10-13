import { cookies } from "next/headers";
import Link from "next/link";
import { FriendButton } from "@/components/FriendButton";
import { PlayerHeader, playerName } from "@/components/PlayerHeader";
import { PlayerLists } from "@/components/PlayerLists";
import { InviteReminder } from "@/components/InviteReminder";
import { FitPair } from "@/components/FitPair";
import { PlayerSearch, searchQuery } from "@/components/PlayerSearch";
import { FRIENDS_TABS, SubTabs } from "@/components/SubTabs";
import { MAX_FRIENDS } from "@/lib/data";
import { requireUser } from "@/lib/supabase/server";
import type { AddedMeRow, FriendRow } from "@/lib/types";
import { DismissAddedYou } from "@/components/DismissAddedYou";
import { FRIENDS_VIEW_COOKIE } from "@/components/ViewToggle";
import { type FriendItem, FriendsBoard } from "@/components/FriendsBoard";
import { FRIEND_SORTS, friendRank, parseFriendSort } from "@/lib/friendSort";

const card = "card p-4";

export default async function FriendsPage({ searchParams }: { searchParams: Promise<{ q?: string; sort?: string }> }) {
  const { supabase, user } = await requireUser();
  const params = await searchParams;
  const q = await searchQuery(Promise.resolve(params));
  const sort = parseFriendSort(params.sort);
  const view = (await cookies()).get(FRIENDS_VIEW_COOKIE)?.value === "grid" ? "grid" : "list";

  const [friendsResult, addedMeResult] = await Promise.all([supabase.rpc("get_friends"), supabase.rpc("get_added_me")]);
  if (friendsResult.error) throw friendsResult.error;
  // People who added you and are waiting on you (empty if that lookup isn't available yet).
  const addedMe = (addedMeResult.data ?? []) as AddedMeRow[];
  const friends = friendsResult.data as FriendRow[];
  const friendIds = new Set(friends.map((f) => f.user_id));

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <SubTabs tabs={FRIENDS_TABS} active="/friends" query={q ? `q=${encodeURIComponent(q)}` : undefined} />
        <PlayerSearch supabase={supabase} q={q} friendIds={friendIds} viewerId={user.id} />
      </section>

      {addedMe.length > 0 && (
        <section id="added-you" className="scroll-mt-20">
          <h2 className="mb-1 text-lg font-semibold">
            Added you <span className="text-sm font-normal text-slate-500">{addedMe.length}</span>
          </h2>
          <p className="mb-3 text-sm text-slate-500">
            These players have you on their friend list. Add them back to see their candy on your Tier List.
          </p>
          <ul className="space-y-3">
            {addedMe.map((player) => (
              <li key={player.user_id} className={card}>
                <PlayerHeader player={player} isFriend={false} />
                <div className="mt-2 flex justify-end">
                  <DismissAddedYou userId={player.user_id} />
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
        {friends.length < MAX_FRIENDS && (
          <div className="mb-3">
            <InviteReminder friendCount={friends.length} />
          </div>
        )}
        {friends.length > 0 && friends.length < MAX_FRIENDS && (
          <p className="mb-3 text-sm text-slate-500">
            Room for {MAX_FRIENDS - friends.length} more.{" "}
            <Link href="/matches" className="font-semibold underline">
              Find new friends →
            </Link>
          </p>
        )}
        {friends.length === 0 ? (
          <p className="text-sm text-slate-500">
            Search for your in-game friends above, or find new ones in{" "}
            <Link href="/matches" className="underline">Find New Friends</Link>. Then check the{" "}
            <Link href="/tiers" className="underline">Tier List</Link> to see which candy they want most.
          </p>
        ) : (
          <FriendsBoard
            initialSort={sort}
            initialView={view}
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
