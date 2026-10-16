"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { hideSuggestedPlayer, restoreSuggestedPlayer, loadTop3TiersFor } from "@/app/actions";
import { BROWSE_PAGE_SIZE, BROWSE_SORT_HINTS, BROWSE_SORTS, type BrowseOptions, browseQuery, sortPlayers, spotlightOutsideF } from "@/lib/browse";
import { LOW_FIT_PCT } from "@/lib/fit";
import { LINES_BY_ID, linesFromIds } from "@/lib/lines";
import { type Relations, relationOf } from "@/lib/relations";
import type { MatchRow } from "@/lib/types";
import { ViewToggle } from "./ViewToggle";
import { SortMenu } from "./SortMenu";
import { FitLegend } from "./FitLegend";
import { FriendAction } from "./FriendAction";
import { LineChips } from "./LineChips";
import { MatchTile } from "./MatchTile";
import { PlayerHeader, playerName } from "./PlayerHeader";
import { FitWithTop3 } from "./Top3Tiers";

type Tiers = Record<string, Record<string, string>>;

/**
 * Find New's suggested players. Every player comes down once (browse_all), so
 * Recommended / All players, the sorts and the pages all switch here, with no
 * trip to the server; the URL follows along so a reload or a shared link
 * shows the same view. Your Top 3 Spotlight's tiers arrive for the first page with the
 * page, and for everyone else in the background (the Top 3 Spotlight sort waits for
 * them if tapped first).
 */
export function FindNewBoard({
  rows,
  initialHiddenIds = [],
  autoOpenGuide = false,
  relations,
  tops,
  initial,
  initialTiers,
  allTiersLoaded,
  q,
  picked,
  friendsVoted,
}: {
  /** browse_all, Best match order. */
  rows: MatchRow[];
  initialHiddenIds?: string[];
  autoOpenGuide?: boolean;
  relations: Relations;
  /** Your starred lines. */
  tops: string[];
  initial: BrowseOptions;
  /** Tiers already loaded (the first page's, or everyone's when the page opened sorted by Top 3 Spotlight). */
  initialTiers: Tiers;
  allTiersLoaded: boolean;
  /** The search box's query, kept in the URL. */
  q: string;
  /** How many lines you've voted Want or Don't Want on. */
  picked: number;
  friendsVoted: boolean;
}) {
  const [opts, setOpts] = useState<BrowseOptions>({ ...initial, spotlight: Boolean(initial.spotlight && tops.length) });
  const [tiers, setTiers] = useState<Tiers>(initialTiers);
  // Players whose tiers are known (no entry for one of them = all dashes).
  const [known, setKnown] = useState<ReadonlySet<string> | "all">(allTiersLoaded ? "all" : new Set(Object.keys(initialTiers)));
  const [view, setView] = useState<"list" | "grid">("list");
  const [tierRetry, setTierRetry] = useState(0);
  const [tierError, setTierError] = useState(false);
  const [hidden, setHidden] = useState(() => new Set(initialHiddenIds));
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [hideError, setHideError] = useState("");
  const [lastHidden, setLastHidden] = useState<MatchRow | null>(null);
  const top = useRef<HTMLElement>(null);

  useEffect(() => {
    try { if (localStorage.getItem("pleep.findNewView") === "grid") setView("grid"); } catch {}
  }, []);
  function changeView(next: "list" | "grid") {
    setView(next);
    try { localStorage.setItem("pleep.findNewView", next); } catch {}
  }

  // Everyone's tiers, once, in the background.
  useEffect(() => {
    if (allTiersLoaded || tops.length === 0 || rows.length === 0) return;
    let live = true;
    setTierError(false);
    loadTop3TiersFor(rows.map((r) => r.user_id))
      .then((all) => {
        if (!live) return;
        setTiers(all);
        setKnown("all");
      })
      .catch(() => live && setTierError(true));
    return () => {
      live = false;
    };
  }, [allTiersLoaded, tops.length, rows, tierRetry]);

  const tiersReady = known === "all";
  // Sorting by Top 3 Spotlight before the tiers are in: keep Best match order until they are.
  const effectiveSort = opts.sort === "top3" && !tiersReady ? "fit" : opts.sort;
  const listed = useMemo(() => {
    const pool = rows.filter((r) => !hidden.has(r.user_id) && (opts.everyone || r.good) && (!opts.spotlight || (tiersReady && spotlightOutsideF(tops, tiers[r.user_id]))));
    return sortPlayers(pool, effectiveSort, tiers);
  }, [rows, hidden, opts.everyone, opts.spotlight, effectiveSort, tiers, tiersReady, tops]);

  const filterWaiting = Boolean(opts.spotlight && !tiersReady);
  const total = listed.length;
  const pages = Math.max(1, Math.ceil(total / BROWSE_PAGE_SIZE));
  const page = Math.min(opts.page, pages);
  const shown = listed.slice((page - 1) * BROWSE_PAGE_SIZE, page * BROWSE_PAGE_SIZE);

  function change(next: Partial<BrowseOptions>, scroll = false) {
    const merged = { ...opts, page: 1, ...next };
    setOpts(merged);
    window.history.replaceState(window.history.state, "", `/matches${browseQuery(merged, q)}`);
    if (scroll) top.current?.scrollIntoView({ block: "start" });
  }

  useEffect(() => {
    if (filterWaiting || opts.page <= pages) return;
    const merged = { ...opts, page: pages };
    setOpts(merged);
    window.history.replaceState(window.history.state, "", `/matches${browseQuery(merged, q)}`);
  }, [opts, pages, q, filterWaiting]);

  async function setPlayerHidden(id: string, hide: boolean) {
    if (pending.has(id)) return;
    setPending((prev) => new Set(prev).add(id));
    setHideError("");
    try {
      const result = await (hide ? hideSuggestedPlayer(id) : restoreSuggestedPlayer(id));
      if (result.error) { setHideError(result.error); return; }
      setHidden((prev) => {
        const next = new Set(prev);
        if (hide) next.add(id); else next.delete(id);
        return next;
      });
      setLastHidden(hide ? rows.find((r) => r.user_id === id) ?? null : null);
    } catch {
      setHideError(`Couldn't ${hide ? "hide" : "restore"} this player. Try again.`);
    } finally {
      setPending((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }
  }

  const hideControl = (match: MatchRow) => (
    <button type="button" className="text-xs font-semibold text-slate-500 underline disabled:opacity-50"
      aria-label={`Hide ${playerName(match)} from suggestions`} disabled={pending.has(match.user_id)}
      onClick={() => void setPlayerHidden(match.user_id, true)}>
      {pending.has(match.user_id) ? "Hiding…" : "Hide"}
    </button>
  );

  const tiersOf = (id: string) => (known === "all" || known.has(id) ? { tops, tiers: tiers[id] } : null);

  return (
    <section ref={top} className="scroll-mt-20 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h2 className="text-lg font-semibold">
          Suggested Players <span className="text-sm font-normal text-slate-500">{filterWaiting ? "…" : total}</span>
        </h2>
        <FitLegend compact friendsVoted={friendsVoted} youVoted={picked > 0} autoOpen={autoOpenGuide} />
      </div>
      <div className="space-y-2">
        <div className="inline-flex overflow-hidden rounded-xl border border-slate-300 text-sm dark:border-slate-700" role="group" aria-label="Suggested player pool">
          <Pill active={!opts.everyone} onClick={() => change({ everyone: false })}>Recommended</Pill>
          <Pill active={opts.everyone} onClick={() => change({ everyone: true })}>All players</Pill>
        </div>
        <p className="text-xs text-slate-500">
          {opts.everyone ? "All eligible players active here in the last 2 months, including those without match scores yet."
            : `Recommended: at least ${LOW_FIT_PCT}% both ways, with at least 3 of your Want candies among what they are likely to send. Scores can include global votes.`}
        </p>
      </div>
      <div className="flex items-center justify-between gap-3">
        <SortMenu value={opts.sort} options={BROWSE_SORTS} hints={BROWSE_SORT_HINTS} onChange={(sort) => change({ sort })} />
        <ViewToggle view={view} onChange={changeView} />
      </div>
      <div className="space-y-1 text-sm">
        <label className="flex w-fit cursor-pointer items-center gap-2">
          <input type="checkbox" checked={Boolean(opts.spotlight)} disabled={tops.length === 0}
            onChange={(e) => change({ spotlight: e.target.checked })} className="h-4 w-4 accent-want" />
          Keep my Spotlight out of F
        </label>
        <p className="text-xs text-slate-500">{tops.length === 0
          ? <><Link href="/vote" className="underline">Set your Top 3 Spotlight</Link> to use this filter.</>
          : "Every spotlighted candy must have a known S–C tier on their friends' Tier List. Unknown tiers do not qualify."}</p>
      </div>
      {(opts.sort === "top3" || opts.spotlight) && !tiersReady && tops.length > 0 && (
        <p className="text-xs font-semibold text-slate-500" role={tierError ? "alert" : "status"}>
          {tierError ? <>Couldn&apos;t load Spotlight tiers. <button type="button" onClick={() => setTierRetry((n) => n + 1)} className="underline">Try again</button>.</>
            : "Loading Spotlight tiers…"}
        </p>
      )}

      {hideError && <p role="alert" className="text-sm text-red-600 dark:text-red-300">{hideError}</p>}
      {lastHidden && hidden.has(lastHidden.user_id) && (
        <p role="status" className="text-sm text-slate-500">
          {playerName(lastHidden)} hidden. {" "}
          <button type="button" className="font-semibold underline" disabled={pending.has(lastHidden.user_id)}
            onClick={() => void setPlayerHidden(lastHidden.user_id, false)}>Undo</button>
        </p>
      )}
      {hidden.size > 0 && (
        <details className="rounded-xl border border-slate-300 p-3 text-sm dark:border-slate-700">
          <summary className="w-fit cursor-pointer font-semibold">Hidden players ({hidden.size})</summary>
          <p className="mt-2 text-xs text-slate-500">Hidden players stay out of your suggestions until you restore them.</p>
          <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">
            {[...hidden].map((id) => {
              const row = rows.find((r) => r.user_id === id);
              const name = row ? playerName(row) : "Player no longer suggested";
              return <li key={id} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate">{name}</span>
                <button type="button" className="shrink-0 font-semibold underline disabled:opacity-50"
                  aria-label={`Restore ${name}`} disabled={pending.has(id)} onClick={() => void setPlayerHidden(id, false)}>
                  {pending.has(id) ? "Restoring…" : "Restore"}
                </button>
              </li>;
            })}
          </ul>
        </details>
      )}

      {filterWaiting ? (
        <p className="py-8 text-center text-slate-500">{tierError ? "Spotlight results are unavailable until tiers load." : "Checking players against your Spotlight…"}</p>
      ) : picked === 0 && relations.friendIds.length === 0 && !opts.everyone ? (
        <p className="py-8 text-center text-slate-500">
          Add your friends (or <Link href="/vote" className="underline">vote</Link> on some candies) so we know what your
          group wants, or{" "}
          <button type="button" onClick={() => change({ everyone: true })} className="underline">
            see everyone
          </button>
          .
        </p>
      ) : shown.length === 0 ? (
        <p className="py-8 text-center text-slate-500">
          {opts.spotlight ? (
            <>No players meet these filters. <button type="button" className="underline" onClick={() => change({ spotlight: false })}>Clear the Spotlight filter</button> to see more players.</>
          ) : opts.everyone ? (
            "No one to suggest right now. Check back as more players join."
          ) : (
            <>
              No recommended players yet (at least {LOW_FIT_PCT}% both ways and 3 of your wants on their Tier List).{" "}
              <button type="button" onClick={() => change({ everyone: true })} className="underline">
                See everyone
              </button>{" "}
              instead.
            </>
          )}
        </p>
      ) : (
        <>
          {view === "list" ? (
            <ul className="space-y-4">
              {shown.map((match) => {
                const t = tiersOf(match.user_id);
                return (
                  <li key={match.user_id} className="card p-4">
                    <PlayerHeader
                      player={match}
                      aside={<FitWithTop3 they={match.match_pct} you={match.you_fit_pct} context={match} tops={t?.tops} tiers={t?.tiers} />}
                    />
                    <FitLists match={match} />
                    <NewPlayerNote match={match} name={playerName(match)} />
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <FriendAction
                        userId={match.user_id}
                        name={playerName(match)}
                        relation={relationOf(relations, match.user_id)}
                        showsCode={Boolean(match.friend_code)}
                      />
                      {hideControl(match)}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <ul className="grid grid-cols-2 items-start gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {shown.map((match) => (
                <MatchTile
                  key={match.user_id}
                  match={match}
                  relation={relationOf(relations, match.user_id)}
                  top3={tiersOf(match.user_id) ?? undefined}
                  hideControl={hideControl(match)}
                />
              ))}
            </ul>
          )}
        </>
      )}

      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-between pt-2 text-sm">
          {page > 1 ? (
            <button type="button" onClick={() => change({ page: page - 1 }, true)} className="font-semibold underline">
              ← Previous
            </button>
          ) : (
            <span />
          )}
          <span className="text-slate-500">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <button type="button" onClick={() => change({ page: page + 1 }, true)} className="font-semibold underline">
              Next →
            </button>
          ) : (
            <span />
          )}
        </nav>
      )}
    </section>
  );
}

/** A filter or sort pill; the active one is filled. An optional hint shows on hover. */
function Pill({ active, onClick, hint, children }: { active: boolean; onClick: () => void; hint?: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint}
      aria-pressed={active}
      className={`px-3 py-2 font-semibold ${
        active
          ? "bg-night text-white dark:bg-sun dark:text-[#5b3e00]"
          : "hover:bg-white/60 dark:hover:bg-night"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Why "for them" is a dash: they haven't voted. Their friends' side never
 * waits: until their friends vote, everyone's votes stand in
 * (20261026000300_blend_demand.sql).
 */
function NewPlayerNote({ match, name }: { match: MatchRow; name: string }) {
  if (match.voted !== false) return null;
  const text = `${name} hasn't voted yet, so "for them" isn't ready yet.`;
  return (
    <p className="mt-3 rounded-xl bg-sky/60 px-3 py-2 text-xs dark:bg-night-deep">
      <b>New here:</b> {text}
    </p>
  );
}

/**
 * Their Top 3 Spotlight always shown, then a dropdown with both directions: what
 * they'd send you (your wants and don't-wants their friends want) and what
 * you'd send them (their wants and don't-wants your friends want).
 */
function FitLists({ match }: { match: MatchRow }) {
  const tops = match.top_wants ?? [];
  const chips = (ids: string[] | undefined) => (ids ?? []).flatMap((id) => LINES_BY_ID.get(id) ?? []);
  const toYou = { want: match.you_fit_wants ?? [], dont: match.you_fit_dont_wants ?? [] };
  const toThem = { want: match.fit_wants, dont: match.fit_dont_wants };
  // Votes are friends-only: a stranger's side comes back empty, so don't present it as "0 they want".
  const hidden = Boolean(match.votes_hidden);
  // Not friends yet (always, on Find New): their side is hidden, so only "They'd send you" is shown.
  const any = toYou.want.length + toYou.dont.length + (hidden ? 0 : toThem.want.length + toThem.dont.length) > 0;
  if (tops.length === 0 && !any) return null;
  const group = (title: string, color: string, ids: string[]) =>
    ids.length > 0 && (
      <div>
        <h5 className={`mb-2 text-sm font-semibold ${color}`}>{title}</h5>
        <LineChips lines={chips(ids)} />
      </div>
    );
  return (
    <div className="mt-3 space-y-3">
      {tops.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-sun-deep">★ Top 3 Spotlight</h4>
          <LineChips lines={linesFromIds(tops)} />
        </div>
      )}
      {any && (
        <details>
          <summary className="cursor-pointer text-sm font-semibold">
            They&apos;d send you {toYou.want.length} you want
            {!hidden && <> · You&apos;d send them {toThem.want.length} they want</>}
          </summary>
          <div className="mt-3 space-y-5">
            <div className="space-y-3">
              <h4 className="font-bold">They'd Send You</h4>
              {group("Your wants matching their friends' wants", "text-want", toYou.want)}
              {group("Your don't-wants matching their friends' wants", "text-dont", toYou.dont)}
              {toYou.want.length + toYou.dont.length === 0 && (
                <p className="text-sm text-slate-500">Nothing you&apos;ve voted on is on their list yet.</p>
              )}
            </div>
            {!hidden && (
              <div className="space-y-3">
                <h4 className="font-bold">You'd Send Them</h4>
                {group("Their wants matching your friends' wants", "text-want", toThem.want)}
                {group("Their don't-wants matching your friends' wants", "text-dont", toThem.dont)}
                {toThem.want.length + toThem.dont.length === 0 && (
                  <p className="text-sm text-slate-500">Nothing they&apos;ve voted on is on your list yet.</p>
                )}
              </div>
            )}
          </div>
        </details>
      )}
    </div>
  );
}
