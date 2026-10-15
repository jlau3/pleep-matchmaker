import Link from "next/link";
import { FriendAction } from "@/components/FriendAction";
import { PlayerHeader, playerName } from "@/components/PlayerHeader";
import { PlayerLists } from "@/components/PlayerLists";
import { FriendPostCard } from "@/components/FriendPostCard";
import { friendPostProps } from "@/lib/friendPost";
import { InviteReminder } from "@/components/InviteReminder";
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
  // Declines first: they need an OK from you.
  const sentSorted = [...sent].sort((a, b) => Number(b.status === "declined") - Number(a.status === "declined"));

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
            These players want to be friends here and in Pokémon Sleep. Accept to add each other; their friend code is
            on the card so you can accept (or send) their request in the game too.
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
                      {maybe.strong ? "If it's them" : "The names are close; check their icon. If it's them"}, accept and
                      they come off that list.
                    </p>
                  )}
                  <PlayerHeader
                    player={player}
                    relation="incoming"
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
        <section id="sent" className="scroll-mt-20">
          <h2 className="mb-1 text-lg font-semibold">
            Sent requests <span className="text-sm font-normal text-slate-500">{sent.length}</span>
          </h2>
          <p className="mb-3 text-sm text-slate-500">
            Waiting for these players to accept. Send them a request in Pokémon Sleep too. Requests not answered in 30
            days lapse; you can send another.
          </p>
          <ul className="space-y-3">
            {sentSorted.map((player) => (
              <li key={player.user_id} className={card}>
                <PlayerHeader player={player} relation={player.status === "declined" ? "declined" : "sent"} />
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
        {placeholders && (
          <div id="not-here-yet" className="mb-3 scroll-mt-20">
            <FriendPlaceholders rows={placeholders} relations={relations} viewerId={user.id} />
          </div>
        )}
        {friends.length < MAX_FRIENDS && (
          <div className="mb-3">
            <InviteReminder friendCount={friends.length} />
          </div>
        )}
        {friends.length === 0 ? (
          <p className="text-sm text-slate-500">
            Search for your Pokémon Sleep friends above and send them a friend request, or find new ones in{" "}
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
                      relation="friend"
                      aside={<FitPair they={friend.match_pct} you={friend.you_fit_pct} />}
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
