import Link from "next/link";
import { FriendButton } from "@/components/FriendButton";
import { PlayerHeader, playerName } from "@/components/PlayerHeader";
import { PlayerLists } from "@/components/PlayerLists";
import { requireUser } from "@/lib/supabase/server";
import type { FriendRow, LookupRow } from "@/lib/types";

const MAX_FRIENDS = 50;
const card = "rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900";

export default async function FriendsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { supabase } = await requireUser();
  const q = ((await searchParams).q ?? "").trim().slice(0, 64);

  const [friendsResult, lookupResult] = await Promise.all([
    supabase.rpc("get_friends"),
    q ? supabase.rpc("lookup_players", { q }) : Promise.resolve({ data: [], error: null }),
  ]);
  if (friendsResult.error) throw friendsResult.error;
  if (lookupResult.error) throw lookupResult.error;
  const friends = friendsResult.data as FriendRow[];
  const results = lookupResult.data as LookupRow[];
  const friendIds = new Set(friends.map((f) => f.user_id));

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-2xl font-bold">Friends</h1>
        <form className="flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Exact Discord name, IGN or friend code"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
          />
          <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white dark:bg-white dark:text-slate-900">
            Search
          </button>
        </form>

        {q && results.length === 0 && (
          <p className="py-4 text-center text-sm text-slate-500">
            No one found. Names have to match exactly, and some players turn lookup off.
          </p>
        )}
        {results.length > 0 && (
          <ul className="space-y-3">
            {results.map((player) => (
              <li key={player.user_id} className={card}>
                <PlayerHeader player={player} isFriend={friendIds.has(player.user_id)} />
                <PlayerLists wants={player.wants} dontWants={player.dont_wants} open />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">
          My friends{" "}
          <span className="text-sm font-normal text-slate-500">
            {friends.length} / {MAX_FRIENDS}
          </span>
        </h2>
        {friends.length === 0 ? (
          <p className="text-sm text-slate-500">
            Search for your in-game friends above, or find new ones in{" "}
            <Link href="/matches" className="underline">Matchmake</Link>. Then check the{" "}
            <Link href="/tiers" className="underline">Tier list</Link> to see which candy they want most.
          </p>
        ) : (
          <ul className="space-y-3">
            {friends.map((friend) => (
              <li key={friend.user_id} className={card}>
                {friend.visible ? (
                  <>
                    <PlayerHeader player={friend} isFriend />
                    <PlayerLists wants={friend.wants} dontWants={friend.dont_wants} />
                  </>
                ) : (
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span>
                      <strong>{playerName(friend)}</strong>
                      <span className="ml-2 text-slate-500">has made their list private</span>
                    </span>
                    <FriendButton userId={friend.user_id} isFriend />
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
