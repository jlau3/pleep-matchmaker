import { type CandyLine, LINES, TOP_MULTIPLIER } from "./lines";

export type TierId = "top" | "S" | "A" | "B" | "C" | "avoid";

export interface Tier {
  id: TierId;
  label: string;
  hint: string;
}

/**
 * The tier list answers "which candy should I send my friends?", so it ranks
 * by demand, not by net votes: demand = wants, with a Top 3 star counting
 * TOP_MULTIPLIER times. A don't-want adds nothing (it is zero demand from that
 * player) and never cancels someone else's want: 3 wants and 3 don't-wants is
 * still 3 people who'd like that candy.
 *
 * Tiers are relative: lines with any demand are ranked, and the top
 * TIER_SHARES.S go to S, the next TIER_SHARES.A to A, the next TIER_SHARES.B to
 * B, the rest to C. Lines that tie on demand share a tier, placed by the tie's
 * middle rank (the best-ranked tie is always S). With no demand at all, a line
 * is Avoid if anyone said don't want, otherwise C.
 *
 * Above S, the Top 3 row repeats the TOP_ROW_SIZE lines the pool starred most.
 * They also stay in their regular tier, so the rest of the list never shifts.
 */
export const TIER_SHARES = { S: 0.15, A: 0.2, B: 0.3 } as const;

/** How many of the most-starred lines the Top 3 row shows. */
export const TOP_ROW_SIZE = 9;

const pct = (x: number) => Math.round(x * 100);

export const TIERS: Tier[] = [
  { id: "top", label: "Top 3", hint: `the ${TOP_ROW_SIZE} candies most often in players' Top 3` },
  { id: "S", label: "S", hint: `top ${pct(TIER_SHARES.S)}% most wanted` },
  { id: "A", label: "A", hint: `next ${pct(TIER_SHARES.A)}%` },
  { id: "B", label: "B", hint: `next ${pct(TIER_SHARES.B)}%` },
  { id: "C", label: "C", hint: "the rest, including candies nobody has voted on" },
  { id: "avoid", label: "Avoid", hint: "nobody wants it and someone said don't want" },
];

export interface LineVotes {
  wants: number;
  dontWants: number;
  /** Players who starred it as one of their Top 3 (a subset of wants). */
  tops?: number;
}

export interface RankedLine {
  line: CandyLine;
  wants: number;
  dontWants: number;
  /** Voters in the pool who neither want nor don't want it (undecided or skipped). */
  unsure: number;
  /** Wants with stars weighted (see demandVotes); what tiers rank on. */
  demand: number;
  tops: number;
  /**
   * Share of the pool who want it, 0 to 1, stars not weighted ("72% want it").
   * Null with no voters. Tiers are relative, so this shows how strong the
   * demand behind a rank actually is.
   */
  wantShare: number | null;
}

/**
 * Demand with Top 3 stars weighted: a starred want counts TOP_MULTIPLIER times
 * (so 2 instead of 1), the same weighting matching uses. Don't-wants add nothing.
 */
export function demandVotes(votes: LineVotes): number {
  return votes.wants + (TOP_MULTIPLIER - 1) * (votes.tops ?? 0);
}

const byRank = (a: RankedLine, b: RankedLine) =>
  b.demand - a.demand || b.line.weight - a.line.weight || a.dontWants - b.dontWants || a.line.dex - b.line.dex;

/**
 * Buckets lines into tiers (see TIER_SHARES), best first inside each tier (weighted net, then rarity
 * weight, then wants, then dex). The Top 3 row repeats the TOP_ROW_SIZE most-starred
 * lines, ordered by stars and then the same keys.
 */
export function buildTiers(
  votes: Map<string, LineVotes>,
  voters: number,
  lines: CandyLine[] = LINES,
): Map<TierId, RankedLine[]> {
  const all: RankedLine[] = lines.map((line) => {
    const v = votes.get(line.id) ?? { wants: 0, dontWants: 0 };
    return {
      line,
      wants: v.wants,
      dontWants: v.dontWants,
      unsure: Math.max(0, voters - v.wants - v.dontWants),
      demand: demandVotes(v),
      tops: v.tops ?? 0,
      wantShare: voters > 0 ? v.wants / voters : null,
    };
  });
  const top = all
    .filter((r) => r.tops > 0)
    .sort((a, b) => b.tops - a.tops || byRank(a, b))
    .slice(0, TOP_ROW_SIZE);
  const out = new Map<TierId, RankedLine[]>(TIERS.map((t) => [t.id, []]));
  out.set("top", top);
  // No demand: Avoid if anyone said don't want, otherwise C (nobody has an opinion).
  for (const r of all) if (r.demand === 0) out.get(r.dontWants > 0 ? "avoid" : "C")!.push(r);

  // Wanted lines fill S/A/B/C by rank. A run of lines tied on demand all go to
  // the tier of the run's middle position, so with few voters (lots of ties)
  // tier sizes stay near their targets instead of one tie swallowing S.
  const positive = all.filter((r) => r.demand > 0).sort(byRank);
  const n = positive.length;
  const ends: [Exclude<TierId, "top" | "avoid">, number][] = [
    ["S", Math.ceil(TIER_SHARES.S * n)],
    ["A", Math.ceil((TIER_SHARES.S + TIER_SHARES.A) * n)],
    ["B", Math.ceil((TIER_SHARES.S + TIER_SHARES.A + TIER_SHARES.B) * n)],
    ["C", n],
  ];
  for (let start = 0; start < n; ) {
    let end = start;
    while (end + 1 < n && positive[end + 1].demand === positive[start].demand) end++;
    const mid = Math.floor((start + end) / 2);
    // The best-ranked run is always S, so S is never empty (e.g. one friend's wants all tie).
    const tier = start === 0 ? "S" : ends.find(([, e]) => mid < e)![0];
    for (let i = start; i <= end; i++) out.get(tier)!.push(positive[i]);
    start = end + 1;
  }

  for (const [id, ranked] of out) {
    if (id !== "top") ranked.sort(byRank);
  }
  return out;
}

/** Vote counts per line from a set of players' want / don't-want / starred lists. */
export function countVotes(players: { wants: string[]; dont_wants: string[]; top_wants?: string[] }[]): Map<string, LineVotes> {
  const votes = new Map<string, LineVotes>();
  const get = (id: string) => {
    let v = votes.get(id);
    if (!v) votes.set(id, (v = { wants: 0, dontWants: 0, tops: 0 }));
    return v;
  };
  for (const p of players) {
    for (const id of new Set(p.wants)) get(id).wants++;
    for (const id of new Set(p.dont_wants)) get(id).dontWants++;
    for (const id of new Set(p.top_wants ?? [])) get(id).tops!++;
  }
  return votes;
}
