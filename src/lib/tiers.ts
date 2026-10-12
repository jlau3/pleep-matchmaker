import { type CandyLine, LINES, TOP_MULTIPLIER } from "./lines";

export type TierId = "top" | "S" | "A" | "B" | "C" | "avoid";

export interface Tier {
  id: TierId;
  label: string;
  hint: string;
}

/**
 * Tiers are relative: lines are ranked by weighted net votes (wants minus
 * don't-wants, stars counting TOP_MULTIPLIER times), and among lines with a
 * positive net the top TIER_SHARES.S go to S, the next TIER_SHARES.A to A, the
 * next TIER_SHARES.B to B, the rest to C. Lines that tie on net always share a
 * tier. Net 0 (no votes or an even split) is C, net below 0 is Avoid.
 *
 * Fixed % cutoffs crowded S and Avoid with a small, decisive player base, and
 * would drift as the pool grows; shares give every pool a usable spread.
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
  { id: "S", label: "S", hint: `top ${pct(TIER_SHARES.S)}% of liked candies` },
  { id: "A", label: "A", hint: `next ${pct(TIER_SHARES.A)}% of liked candies` },
  { id: "B", label: "B", hint: `next ${pct(TIER_SHARES.B)}% of liked candies` },
  { id: "C", label: "C", hint: "the rest, including no votes and even splits" },
  { id: "avoid", label: "Avoid", hint: "more don't want it than want it" },
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
  net: number;
  tops: number;
}

/**
 * Net votes with Top 3 stars weighted: a starred want counts TOP_MULTIPLIER
 * times (so +2 instead of +1), the same weighting matching uses.
 */
export function netVotes(votes: LineVotes): number {
  return votes.wants + (TOP_MULTIPLIER - 1) * (votes.tops ?? 0) - votes.dontWants;
}

const byRank = (a: RankedLine, b: RankedLine) =>
  b.net - a.net || b.line.weight - a.line.weight || b.wants - a.wants || a.line.dex - b.line.dex;

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
      net: netVotes(v),
      tops: v.tops ?? 0,
    };
  });
  const top = all
    .filter((r) => r.tops > 0)
    .sort((a, b) => b.tops - a.tops || byRank(a, b))
    .slice(0, TOP_ROW_SIZE);
  const out = new Map<TierId, RankedLine[]>(TIERS.map((t) => [t.id, []]));
  out.set("top", top);
  for (const r of all) if (r.net <= 0) out.get(r.net < 0 ? "avoid" : "C")!.push(r);

  // Positive lines fill S/A/B/C by rank; a tie on net stays with the line above it.
  const positive = all.filter((r) => r.net > 0).sort(byRank);
  const n = positive.length;
  const ends: [Exclude<TierId, "top" | "avoid">, number][] = [
    ["S", Math.ceil(TIER_SHARES.S * n)],
    ["A", Math.ceil((TIER_SHARES.S + TIER_SHARES.A) * n)],
    ["B", Math.ceil((TIER_SHARES.S + TIER_SHARES.A + TIER_SHARES.B) * n)],
    ["C", n],
  ];
  let tier: Exclude<TierId, "top" | "avoid"> = "S";
  positive.forEach((r, i) => {
    if (i === 0 || r.net !== positive[i - 1].net) tier = ends.find(([, end]) => i < end)![0];
    out.get(tier)!.push(r);
  });

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
