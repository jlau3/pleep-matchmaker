import Link from "next/link";
import { TierBoard } from "@/components/TierBoard";
import { ISLANDS, LINES } from "@/lib/lines";
import { requireUser } from "@/lib/supabase/server";
import { buildTiers, countVotes, type LineVotes } from "@/lib/tiers";
import type { FriendRow, LineStatRow } from "@/lib/types";

type Pool = "friends" | "everyone";

export default async function TiersPage({ searchParams }: { searchParams: Promise<{ pool?: string; island?: string }> }) {
  const { supabase } = await requireUser();
  const params = await searchParams;
  const pool: Pool = params.pool === "everyone" ? "everyone" : "friends";
  const mappedIslands = ISLANDS.filter((island) => island.lines.length > 0);
  const island = mappedIslands.find((i) => i.id === params.island);

  let votes: Map<string, LineVotes>;
  let voters: number;
  if (pool === "friends") {
    const { data, error } = await supabase.rpc("get_friends");
    if (error) throw error;
    const players = (data as FriendRow[]).filter((f) => f.visible && f.wants.length + f.dont_wants.length > 0);
    votes = countVotes(players);
    voters = players.length;
  } else {
    const [stats, count] = await Promise.all([supabase.rpc("get_line_stats"), supabase.rpc("get_voter_count")]);
    if (stats.error) throw stats.error;
    if (count.error) throw count.error;
    votes = new Map(
      (stats.data as LineStatRow[]).map((row) => [row.line_id, { wants: Number(row.wants), dontWants: Number(row.dont_wants) }]),
    );
    voters = Number(count.data);
  }

  const lines = island ? LINES.filter((line) => island.lines.includes(line.id)) : LINES;
  const tiers = buildTiers(votes, voters, lines);
  const href = (next: { pool?: Pool; island?: string | null }) => {
    const p = new URLSearchParams();
    const nextPool = next.pool ?? pool;
    const nextIsland = next.island === undefined ? island?.id : next.island;
    if (nextPool === "everyone") p.set("pool", "everyone");
    if (nextIsland) p.set("island", nextIsland);
    const qs = p.toString();
    return qs ? `/tiers?${qs}` : "/tiers";
  };
  const pill = (active: boolean) =>
    `rounded-full border px-3 py-1 text-sm ${
      active
        ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900"
        : "border-slate-300 dark:border-slate-700"
    }`;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Tier list</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Which candy to prioritize, ranked by net votes (wants minus don&apos;t-wants) from{" "}
          {pool === "friends" ? `your ${voters} ${voters === 1 ? "friend" : "friends"}` : `${voters} active players`}.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href={href({ pool: "friends" })} className={pill(pool === "friends")}>
          My friends
        </Link>
        <Link href={href({ pool: "everyone" })} className={pill(pool === "everyone")}>
          Everyone
        </Link>
      </div>
      {mappedIslands.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Link href={href({ island: null })} className={pill(!island)}>
            All islands
          </Link>
          {mappedIslands.map((i) => (
            <Link key={i.id} href={href({ island: i.id })} className={pill(island?.id === i.id)}>
              {i.name}
            </Link>
          ))}
        </div>
      )}

      {voters === 0 ? (
        <p className="py-8 text-center text-slate-500">
          {pool === "friends" ? (
            <>
              No votes from friends yet. <Link href="/friends" className="underline">Add friends</Link> to build your tier list.
            </>
          ) : (
            "No votes yet."
          )}
        </p>
      ) : (
        <TierBoard tiers={tiers} />
      )}
    </div>
  );
}
