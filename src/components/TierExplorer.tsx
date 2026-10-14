"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ISLANDS, LINES, SLEEP_TYPE_LABEL, SLEEP_TYPES, lineSpriteUrl, sleepTypeMember, spriteUrl, type SleepType } from "@/lib/lines";
import { buildTiers, type LineVotes } from "@/lib/tiers";
import { InviteButton } from "./InviteButton";
import { InviteReminder } from "./InviteReminder";
import { RefreshStamp } from "./RefreshStamp";
import { TierBoard } from "./TierBoard";
import { TierExport } from "./TierExport";

export type Pool = "friends" | "everyone";

/** One pool's vote totals, as the server sends them. */
export interface PoolVotes {
  votes: Record<string, LineVotes>;
  /** Players in the pool with at least one want or don't-want. */
  voters: number;
  /** Everyone on your list, voted or not (friends pool only). */
  friendCount: number;
}

const POOL_LABEL: Record<Pool, string> = { friends: "My Friends", everyone: "Everyone" };
const MAPPED_ISLANDS = ISLANDS.filter((island) => island.lines.length > 0);

/** Island art from Neroli's Lab (public/islands, Apache-2.0; see NOTICE there). Expert areas reuse the base art. */
const ISLAND_ART: Record<string, string> = {
  "greengrass-isle": "greengrass",
  "cyan-beach": "cyan",
  "taupe-hollow": "taupe",
  "snowdrop-tundra": "snowdrop",
  "lapis-lakeside": "lapis",
  "old-gold-power-plant": "powerplant",
  "amber-canyon": "amber",
};
/** Dot color per sleep type, after the in-game colors. */
const SLEEP_DOT: Record<SleepType, string> = {
  dozing: "bg-[#f2c94c]",
  snoozing: "bg-[#5aa9e6]",
  slumbering: "bg-[#8a6fd1]",
};
const islandArt = (id: string) => ISLAND_ART[id.replace(/-expert$/, "")];
/** Short label under the icon: "Greengrass", "Cyan EX", "Power Plant". */
const shortName = (name: string) =>
  name.replace(/^Old Gold /, "").replace(/ (Isle|Beach|Hollow|Tundra|Lakeside|Canyon)/, "").replace(" (Expert)", " EX");

/**
 * The Tier List with every view ready up front: both pools (My Friends,
 * Everyone) by island and sleep type come straight from the vote totals the
 * page loaded, so the pickers switch instantly with no server round trip.
 * The view goes in the URL (replaceState) so a reload or shared link opens it.
 */
export function TierExplorer({
  friends,
  everyone,
  initialPool,
  initialIsland,
  initialSleep,
  loadedAt,
  notice,
}: {
  friends: PoolVotes;
  everyone: PoolVotes;
  initialPool: Pool;
  /** Island id to open on (?island=), or null for all islands. */
  initialIsland: string | null;
  /** Sleep type to open on (?sleep=), or null for all. */
  initialSleep: SleepType | null;
  /** When the server counted these votes (ISO), for "Updated 5m ago". */
  loadedAt: string;
  /** Shown under the heading (e.g. "3 new candies to vote on"). */
  notice?: React.ReactNode;
}) {
  const [pool, setPool] = useState<Pool>(initialPool);
  const [islandId, setIslandId] = useState(
    MAPPED_ISLANDS.some((island) => island.id === initialIsland) ? initialIsland : null,
  );

  const [sleepType, setSleepType] = useState<SleepType | null>(initialSleep);

  function show(next: { pool?: Pool; island?: string | null; sleep?: SleepType | null }) {
    const p = next.pool ?? pool;
    const id = next.island !== undefined ? next.island : islandId;
    const sleep = next.sleep !== undefined ? next.sleep : sleepType;
    setPool(p);
    setIslandId(id);
    setSleepType(sleep);
    const qs = new URLSearchParams();
    if (p === "everyone") qs.set("pool", "everyone");
    if (id) qs.set("island", id);
    if (sleep) qs.set("sleep", sleep);
    const query = qs.toString();
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }

  const data = pool === "friends" ? friends : everyone;
  const poolLabel = POOL_LABEL[pool];
  const selected = MAPPED_ISLANDS.find((island) => island.id === islandId) ?? null;
  // A hundred-odd lines: cheap enough to rank per pick, no need to prebuild every combination.
  // With a sleep type picked, a line shows if a form that spawns here sleeps that way, drawn as that form.
  const tiers = useMemo(() => {
    const shown = new Map<string, string | undefined>();
    for (const line of LINES) {
      if (selected && !selected.lines.includes(line.id)) continue;
      if (!sleepType) shown.set(line.id, undefined);
      else {
        const member = sleepTypeMember(line, sleepType, selected);
        if (member) {
          const sprite = spriteUrl(member.sprite);
          shown.set(line.id, sprite === lineSpriteUrl(line) ? undefined : sprite);
        }
      }
    }
    const built = buildTiers(
      new Map(Object.entries(data.votes)),
      data.voters,
      LINES.filter((line) => shown.has(line.id)),
    );
    for (const rows of built.values()) for (const r of rows) r.sprite = shown.get(r.line.id);
    return built;
  }, [data, selected, sleepType]);
  const pill = (active: boolean) =>
    `rounded-full border px-3 py-1 text-sm ${active ? "pill-active border-transparent" : "border-slate-300 dark:border-slate-700"}`;

  return (
    <div className="space-y-5">
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <h1 className="text-2xl font-bold">Tier List</h1>
          <RefreshStamp loadedAt={loadedAt} />
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Which candy to prioritize, ranked by what {pool === "friends" ? "your friends" : `${data.voters} active players`}{" "}
          want and don&apos;t want.
        </p>
      </div>

      {notice}

      {pool === "friends" && data.voters > 0 && <InviteReminder friendCount={data.friendCount} />}

      <div className="flex flex-wrap items-center gap-2">
        {(["friends", "everyone"] as const).map((p) => (
          <button key={p} type="button" onClick={() => show({ pool: p })} aria-pressed={pool === p} className={pill(pool === p)}>
            {POOL_LABEL[p]}
          </button>
        ))}
        {data.voters > 0 && (
          <div className="ml-auto">
            <TierExport
              title={[poolLabel, selected ? selected.name : "All Islands", sleepType && SLEEP_TYPE_LABEL[sleepType]]
                .filter(Boolean)
                .join(" · ")}
              voters={data.voters}
              sections={[{ tiers }]}
            />
          </div>
        )}
      </div>

      {/* One tap picks an island; tapping it again (or another) goes back / switches. None picked: all islands. */}
      {MAPPED_ISLANDS.length > 0 && (
        <div role="group" aria-label="Island" className="grid grid-cols-5 gap-1 sm:grid-cols-9">
          {MAPPED_ISLANDS.map((island) => {
            const active = island.id === islandId;
            const art = islandArt(island.id);
            return (
              <button
                key={island.id}
                type="button"
                onClick={() => show({ island: active ? null : island.id })}
                aria-pressed={active}
                title={active ? `${island.name} (tap again for all islands)` : island.name}
                className={`flex min-w-0 flex-col items-center gap-1 rounded-2xl p-1 text-[11px] font-semibold leading-tight transition ${
                  active
                    ? "bg-sun/70 ring-2 ring-sun-deep dark:bg-sun/30"
                    : islandId
                      ? "opacity-50 hover:opacity-100"
                      : "hover:bg-white/60 dark:hover:bg-night"
                }`}
              >
                <span className="relative">
                  {art ? (
                    <img src={`/islands/${art}.webp`} alt="" className="h-11 w-11" />
                  ) : (
                    <span className="block h-11 w-11 rounded-full bg-sky dark:bg-night-deep" />
                  )}
                  {island.id.endsWith("-expert") && (
                    <span className="absolute -right-1 -top-1 rounded-full bg-night px-1 text-[9px] font-black text-white dark:bg-sun dark:text-[#5b3e00]">
                      EX
                    </span>
                  )}
                </span>
                <span className="text-center">{shortName(island.name)}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Same one-tap toggle as the islands: a line shows if any of its forms sleeps that way. */}
      <div role="group" aria-label="Sleep type" className="flex flex-wrap items-center gap-2">
        {SLEEP_TYPES.map((type) => {
          const active = type === sleepType;
          return (
            <button
              key={type}
              type="button"
              onClick={() => show({ sleep: active ? null : type })}
              aria-pressed={active}
              title={active ? `${SLEEP_TYPE_LABEL[type]} (tap again for all sleep types)` : `Lines with a ${SLEEP_TYPE_LABEL[type]} form`}
              className={`flex items-center gap-1.5 ${pill(active)} ${sleepType && !active ? "opacity-50 hover:opacity-100" : ""}`}
            >
              <span className={`h-2.5 w-2.5 rounded-full ${SLEEP_DOT[type]}`} aria-hidden />
              {SLEEP_TYPE_LABEL[type]}
            </button>
          );
        })}
      </div>

      {data.voters === 0 ? (
        <p className="py-8 text-center text-slate-500">
          {pool === "friends" ? (
            <>
              No votes from friends yet. <Link href="/friends" className="underline">Add friends</Link> or invite them to
              build your tier list.
              <span className="mt-4 block">
                <InviteButton />
              </span>
            </>
          ) : (
            "No votes yet."
          )}
        </p>
      ) : (
        <TierBoard tiers={tiers} pool={pool} />
      )}
    </div>
  );
}
