import Link from "next/link";
import { FriendButton } from "@/components/FriendButton";
import { PlayerHeader, playerName } from "@/components/PlayerHeader";
import { PlayerLists } from "@/components/PlayerLists";
import { PlayerSearch, searchQuery } from "@/components/PlayerSearch";
import { FRIENDS_TABS, SubTabs } from "@/components/SubTabs";
import { MAX_FRIENDS } from "@/lib/data";
import { requireUser } from "@/lib/supabase/server";
import type { FriendRow } from "@/lib/types";

const card = "card p-4";

export default async function FriendsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { supabase } = await requireUser();
  const q = await searchQuery(searchParams);

  const friendsResult = await supabase.rpc("get_friends");
  if (friendsResult.error) throw friendsResult.error;
  const friends = friendsResult.data as FriendRow[];
  const friendIds = new Set(friends.map((f) => f.user_id));

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <SubTabs tabs={FRIENDS_TABS} active="/friends" query={q ? `q=${encodeURIComponent(q)}` : undefined} />
        <PlayerSearch supabase={supabase} q={q} friendIds={friendIds} />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">
          My Friends{" "}
          <span className="text-sm font-normal text-slate-500">
            {friends.length} / {MAX_FRIENDS}
          </span>
        </h2>
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
            <Link href="/matches" className="underline">Find New</Link>. Then check the{" "}
            <Link href="/tiers" className="underline">Tier List</Link> to see which candy they want most.
          </p>
        ) : (
          <ul className="space-y-3">
            {friends.map((friend) => (
              <li key={friend.user_id} className={card}>
                {friend.visible ? (
                  <>
                    <PlayerHeader
                      player={friend}
                      isFriend
                      aside={
                        friend.match_pct !== null && (
                          <div className="shrink-0 text-right leading-none">
                            <div className="text-2xl font-bold text-want">{friend.match_pct}%</div>
                            <div className="text-xs text-slate-500">match</div>
                          </div>
                        )
                      }
                    />
                    {friend.wants.length + friend.dont_wants.length === 0 ? (
                      <p className="mt-3 text-sm text-slate-500">
                        Hasn&apos;t voted yet. Ping them on Discord to add their wants.
                      </p>
                    ) : (
                      <PlayerLists wants={friend.wants} dontWants={friend.dont_wants} topWants={friend.top_wants} />
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span>
                      <strong>{playerName(friend)}</strong>
                      <span className="ml-2 text-slate-500">has made their list private</span>
                    </span>
                    <FriendButton userId={friend.user_id} isFriend name={playerName(friend)} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
