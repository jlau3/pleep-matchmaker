"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isSleepType, ISLANDS, LINES, SLEEP_TYPE_LABEL, SLEEP_TYPES, lineSpriteUrl, sleepTypeMember, spriteUrl, type SleepType } from "@/lib/lines";
import { buildTiers, buildPublicTiers, TIER_STYLE_LABEL, TIER_STYLES, TIER_STYLE_DESCRIPTION, FIXED_SCORE_CUTOFFS, type TierStyle, type LineVotes } from "@/lib/tiers";
import { InviteButton } from "./InviteButton";
import { InviteReminder } from "./InviteReminder";
import { RefreshStamp } from "./RefreshStamp";
import { TierBoard } from "./TierBoard";
import { TierGuide } from "./TierGuide";
import { TierExport } from "./TierExport";
import { useSignIn } from "./SignInSheet";

export type Pool = "friends" | "everyone";

/** One pool's vote totals, as the server sends them. */
export interface PoolVotes {
  votes: Record<string, LineVotes>;
  /** Active players with saved choices (non-Neutral choices required only in the friends pool). */
  voters: number;
  /** Everyone on your list, voted or not (friends pool only). */
  friendCount: number;
  /** Missing lines have too few votes and must never be assigned a tier. */
  thresholded?: boolean;
}

/** Last view (pool, island, sleep type), so leaving the Tier List and coming back keeps it. */
const VIEW_KEY = "pm_tiers_view";

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
 * The view goes in the URL (replaceState) so a reload or shared link opens it,
 * and in localStorage so coming back from another tab (no query) reopens it.
 */
export function TierExplorer({
  friends,
  everyone,
  initialPool,
  initialIsland,
  initialSleep,
  initialStyle = "standard",
  loadedAt,
  notice,
  signedIn = true,
  viewerId = null,
  everyoneSnapshot,
}: {
  friends: PoolVotes;
  everyone: PoolVotes;
  initialPool: Pool;
  /** Island id to open on (?island=), or null for all islands. */
  initialIsland: string | null;
  /** Sleep type to open on (?sleep=), or null for all. */
  initialSleep: SleepType | null;
  initialStyle?: TierStyle;
  /** When the server counted these votes (ISO), for "Updated 5m ago". */
  loadedAt: string;
  /** Shown under the heading (e.g. "3 new candies to vote on"). */
  notice?: React.ReactNode;
  signedIn?: boolean;
  viewerId?: string | null;
  everyoneSnapshot?: { exportedAt: string; candies: number };
}) {
  const styleMenu = useRef<HTMLDetailsElement>(null);
  const [menuPlacement, setMenuPlacement] = useState({ above: false, maxHeight: 480 });
  const placeStyleMenu = useCallback(() => {
    const menu = styleMenu.current;
    if (!menu?.open) return;
    const rect = menu.querySelector("summary")!.getBoundingClientRect();
    const height = window.innerHeight;
    const below = Math.max(0, height - rect.bottom - 24);
    const headerBottom = document.querySelector("header")?.getBoundingClientRect().bottom ?? 0;
    const above = Math.max(0, rect.top - Math.max(24, headerBottom + 24));
    const openAbove = below < Math.min(360, height * 0.7) && above > below;
    setMenuPlacement({ above: openAbove, maxHeight: Math.max(80, Math.min(480, height * 0.7, openAbove ? above : below)) });
  }, []);
  useEffect(() => {
    window.addEventListener("resize", placeStyleMenu);
    window.addEventListener("scroll", placeStyleMenu, true);
    return () => {
      window.removeEventListener("resize", placeStyleMenu);
      window.removeEventListener("scroll", placeStyleMenu, true);
    };
  }, [placeStyleMenu]);
  const tourRoot = useRef<HTMLDivElement>(null);
  const openSignIn = useSignIn();
  const viewKey = signedIn ? VIEW_KEY : `${VIEW_KEY}_public`;
  const [pool, setPool] = useState<Pool>(signedIn ? initialPool : "everyone");
  const [islandId, setIslandId] = useState(
    MAPPED_ISLANDS.some((island) => island.id === initialIsland) ? initialIsland : null,
  );

  const [style, setStyle] = useState<TierStyle>(initialStyle);
  const [sleepType, setSleepType] = useState<SleepType | null>(initialSleep);

  // Plain /tiers (from the nav): reopen the last view. A link with its own query wins, and
  // becomes the view to reopen (e.g. the first-friend note's link to My Friends).
  useEffect(() => {
    if (!signedIn && new URLSearchParams(window.location.search).get("pool") === "friends") {
      openSignIn(`/tiers${window.location.search}`);
    }
    if (window.location.search) {
      try {
        localStorage.setItem(viewKey, JSON.stringify({ pool, island: islandId, sleep: sleepType }));
      } catch {
        /* Not remembered; fine. */
      }
      return;
    }
    try {
      const saved = JSON.parse(localStorage.getItem(viewKey) ?? "null");
      if (!saved || typeof saved !== "object") return;
      show({
        pool: !signedIn || saved.pool === "everyone" ? "everyone" : "friends",
        island: MAPPED_ISLANDS.some((island) => island.id === saved.island) ? saved.island : null,
        sleep: isSleepType(saved.sleep) ? saved.sleep : null,
      });
    } catch {
      /* Storage unavailable or bad JSON: keep the default view. */
    }
    // Once, on arrival.
  }, []);

  function show(next: { pool?: Pool; island?: string | null; sleep?: SleepType | null; style?: TierStyle }) {
    if (!signedIn && next.pool === "friends") {
      const query = new URLSearchParams({ pool: "friends" });
      if (islandId) query.set("island", islandId);
      if (sleepType) query.set("sleep", sleepType);
      if (style !== "standard") query.set("style", style);
      openSignIn(`/tiers?${query}`);
      return;
    }
    const p = next.pool ?? pool;
    const id = next.island !== undefined ? next.island : islandId;
    const sleep = next.sleep !== undefined ? next.sleep : sleepType;
    const rankingStyle = next.style ?? style;
    setStyle(rankingStyle);
    setPool(p);
    setIslandId(id);
    setSleepType(sleep);
    const qs = new URLSearchParams();
    qs.set("pool", p);
    if (rankingStyle !== "standard") qs.set("style", rankingStyle);
    if (id) qs.set("island", id);
    if (sleep) qs.set("sleep", sleep);
    const query = qs.toString();
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
    try {
      localStorage.setItem(viewKey, JSON.stringify({ pool: p, island: id, sleep }));
    } catch {
      /* Not remembered; fine. */
    }
  }

  const data = pool === "friends" ? friends : everyone;
  const poolLabel = POOL_LABEL[pool];
  const selected = MAPPED_ISLANDS.find((island) => island.id === islandId) ?? null;
  // A hundred-odd lines: cheap enough to rank per pick, no need to prebuild every combination.
  // With a sleep type picked, a line shows if a form that spawns here sleeps that way, drawn as that form.
  const { tiers, unranked } = useMemo(() => {
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
    const lines = LINES.filter((line) => shown.has(line.id));
    const votes = new Map(Object.entries(data.votes));
    const { tiers: built, unranked } = data.thresholded
      ? buildPublicTiers(votes, data.voters, lines, style)
      : { tiers: buildTiers(votes, data.voters, lines, style), unranked: [] };
    for (const rows of built.values()) for (const r of rows) r.sprite = shown.get(r.line.id);
    for (const row of unranked) row.sprite = shown.get(row.line.id);
    return { tiers: built, unranked };
  }, [data, selected, sleepType, style]);
  const pill = (active: boolean) =>
    `rounded-full border px-3 py-1 text-sm ${active ? "pill-active border-transparent" : "border-slate-300 dark:border-slate-700"}`;

  return (
    <div ref={tourRoot} className="space-y-5">
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <h1 className="text-2xl font-bold">Tier List</h1>
          {pool === "everyone" && everyoneSnapshot
            ? <span className="text-xs text-slate-500">Snapshot: {everyoneSnapshot.exportedAt.slice(0, 10)}</span>
            : <RefreshStamp loadedAt={loadedAt} />}
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {style === "consensus" ? "How preferences differ, grouped by votes from" : "Which candy to prioritize, ranked by votes from"}{" "}
          {pool === "friends" ? "your friends" : "active players"}.
        </p>
        {!signedIn && <button type="button" onClick={() => show({ pool: "friends" })} className="mt-2 text-sm font-semibold underline">See what your friends want → Sign in</button>}
      </div>

      {pool === "everyone" && everyoneSnapshot && <p role="status" className="rounded-xl bg-sky/60 px-3 py-2 text-sm dark:bg-night-deep">
        Dev snapshot: {everyone.voters} players · {everyoneSnapshot.candies} candies. Imported totals for comparing styles; My Friends uses your dev friends.
      </p>}
      <TierGuide root={tourRoot} signedIn={signedIn} />

      {notice}

      {pool === "friends" && data.voters > 0 && <InviteReminder friendCount={data.friendCount} />}

      <div className="flex flex-wrap items-center gap-2">
        <div data-tier-tour="pool" className="flex flex-wrap items-center gap-2">
          {(["everyone", "friends"] as const).map((p) => (
            <button key={p} type="button" onClick={() => show({ pool: p })} aria-pressed={pool === p} className={pill(pool === p)}>
              {POOL_LABEL[p]}{!signedIn && p === "friends" && <span aria-hidden="true" className="ml-1">🔒</span>}
            </button>
          ))}
        </div>
        {(data.voters > 0 || data.thresholded) && (
          <div data-tier-tour="export" className="ml-auto">
            <TierExport
              title={[everyoneSnapshot && pool === "everyone" && `Dev Snapshot ${everyoneSnapshot.exportedAt.slice(0, 10)}`, poolLabel, TIER_STYLE_LABEL[style], selected ? selected.name : "All Islands", sleepType && SLEEP_TYPE_LABEL[sleepType]]
                .filter(Boolean)
                .join(" · ")}
              voters={data.voters || null}
              sections={[{ tiers, unranked }]}
              style={style}
            />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">Island</span>
      </div>
      {/* One tap picks an island; tapping it again (or another) goes back / switches. None picked: all islands. */}
      {MAPPED_ISLANDS.length > 0 && (
        <div data-tier-tour="island" role="group" aria-label="Island" className="grid grid-cols-5 gap-1 sm:grid-cols-9">
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div data-tier-tour="sleep" role="group" aria-label="Sleep Type" className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">Sleep Type</span>
          {SLEEP_TYPES.map((type) => {
            const active = type === sleepType;
            return (
              <button
                key={type}
                type="button"
                onClick={() => show({ sleep: active ? null : type })}
                aria-pressed={active}
                title={active ? `${SLEEP_TYPE_LABEL[type]} (tap again for all sleep types)` : `Pokémon with a ${SLEEP_TYPE_LABEL[type]} form`}
                className={`flex items-center gap-1.5 ${pill(active)} ${sleepType && !active ? "opacity-50 hover:opacity-100" : ""}`}
              >
                <span className={`h-2.5 w-2.5 rounded-full ${SLEEP_DOT[type]}`} aria-hidden />
                {SLEEP_TYPE_LABEL[type]}
              </button>
            );
          })}
        </div>
        <details ref={styleMenu} onToggle={placeStyleMenu} data-tier-tour="style" className="relative ml-auto max-w-full text-sm">
          <summary className="w-fit cursor-pointer py-1 font-semibold">Ranking Style: {TIER_STYLE_LABEL[style]}</summary>
          <div style={{ maxHeight: menuPlacement.maxHeight }} className={`absolute right-0 z-20 ${menuPlacement.above ? "bottom-full mb-2" : "top-full mt-2"} w-[min(24rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-slate-300 bg-cream p-3 shadow-lg dark:border-slate-700 dark:bg-night`}>
            <fieldset className="min-w-0 space-y-3 border-0 p-0">
              <legend className="mb-2 w-full p-0 font-semibold">Choose a ranking style</legend>
              <p className="text-xs text-slate-600 dark:text-slate-300">Net support is Want % minus Don't Want %. Neutral adds no points. Negative scores go to Avoid in Standard and Fixed Scores. Numbers are rounded for display; tiers use exact scores.</p>
              {TIER_STYLES.map((option) => <label key={option} className="flex cursor-pointer items-start gap-2">
                <input type="radio" name="tier-style" value={option} checked={style === option}
                  onChange={() => show({ style: option })} className="mt-1 shrink-0 accent-want" />
                <span className="min-w-0"><b>{TIER_STYLE_LABEL[option]}{option === "standard" && " (Recommended)"}</b>
                  <span className="block text-xs text-slate-500">{TIER_STYLE_DESCRIPTION[option]}{option === "fixed" && ` S ${FIXED_SCORE_CUTOFFS.S}, A ${FIXED_SCORE_CUTOFFS.A}, B ${FIXED_SCORE_CUTOFFS.B}, C 0 to below ${FIXED_SCORE_CUTOFFS.B}.`}</span></span>
              </label>)}
            </fieldset>
          </div>
        </details>
      </div>
      {style !== "standard" && <p className="text-sm text-slate-600 dark:text-slate-300">
        You're viewing {TIER_STYLE_LABEL[style]}. For the shared default, <button type="button" onClick={() => show({ style: "standard" })} className="font-semibold underline">use Standard</button>.
      </p>}

      {data.voters === 0 && !data.thresholded ? (
        <p className="py-8 text-center text-slate-500">
          {pool === "friends" ? (
            <>
              No votes from friends yet. <Link href="/friends" className="underline">Add friends</Link> or invite them to
              build your Tier List.
              <span className="mt-4 block">
                <InviteButton />
              </span>
            </>
          ) : (
            "No votes yet."
          )}
        </p>
      ) : (
        <>
          {Array.from(tiers.values()).some((rows) => rows.length > 0) && <TierBoard tiers={tiers} pool={pool} style={style} />}
          {unranked.length > 0 && <section className="card p-4" aria-label="Not enough votes yet">
            <h2 className="font-bold">Not Enough Votes Yet</h2>
            <p className="mt-1 text-sm text-slate-500">These candies need saved votes from at least 10 active players before their tiers and totals are public.</p>
            <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {unranked.map(({ line, sprite }) => <li key={line.id} className="flex flex-col items-center text-center text-xs">
                <img src={sprite ?? lineSpriteUrl(line)} alt="" loading="lazy" className="h-12 w-12 object-contain" />
                {line.name}
              </li>)}
            </ul>
          </section>}
        </>
      )}
    </div>
  );
}
