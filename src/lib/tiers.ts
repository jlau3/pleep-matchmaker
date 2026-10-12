import { type CandyLine, LINES, MAX_TOP } from "./lines";

export type TierId = "top" | "S" | "A" | "B" | "C" | "avoid";

export interface Tier {
  id: TierId;
  label: string;
  hint: string;
}

/**
 * Ranking is by net votes (wants minus don't-wants) as a share of the voters
 * in the pool, so a candy that splits the room ranks below one nobody minds.
 * Lines with no votes or an even split (net 0) land at the bottom of C.
 * Above S, the Top 3 row holds the MAX_TOP lines the pool starred most; they
 * leave their regular tier so every line appears once.
 */
export const TIER_CUTOFFS = { S: 0.6, A: 0.35, B: 0.15 } as const;

export const TIERS: Tier[] = [
  { id: "top", label: "Top 3", hint: "most starred as players' Top 3" },
  { id: "S", label: "S", hint: `${TIER_CUTOFFS.S * 100}%+ net want it` },
  { id: "A", label: "A", hint: `${TIER_CUTOFFS.A * 100}–${TIER_CUTOFFS.S * 100 - 1}%` },
  { id: "B", label: "B", hint: `${TIER_CUTOFFS.B * 100}–${TIER_CUTOFFS.A * 100 - 1}%` },
  { id: "C", label: "C", hint: `under ${TIER_CUTOFFS.B * 100}%` },
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

/** The regular tier from net votes alone; the Top 3 row is picked in buildTiers. */
export function tierFor(votes: LineVotes, voters: number): Exclude<TierId, "top"> {
  const net = votes.wants - votes.dontWants;
  if (net < 0) return "avoid";
  const share = voters === 0 ? 0 : net / voters;
  if (share >= TIER_CUTOFFS.S) return "S";
  if (share >= TIER_CUTOFFS.A) return "A";
  if (share >= TIER_CUTOFFS.B) return "B";
  return "C";
}

const byRank = (a: RankedLine, b: RankedLine) =>
  b.net - a.net || b.line.weight - a.line.weight || b.wants - a.wants || a.line.dex - b.line.dex;

/**
 * Buckets lines into tiers, best first inside each tier (net, then rarity
 * weight, then wants, then dex). The Top 3 row takes the MAX_TOP most-starred
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
      net: v.wants - v.dontWants,
      tops: v.tops ?? 0,
    };
  });
  const top = all
    .filter((r) => r.tops > 0)
    .sort((a, b) => b.tops - a.tops || byRank(a, b))
    .slice(0, MAX_TOP);
  const topIds = new Set(top.map((r) => r.line.id));

  const out = new Map<TierId, RankedLine[]>(TIERS.map((t) => [t.id, []]));
  out.set("top", top);
  for (const r of all) {
    if (!topIds.has(r.line.id)) out.get(tierFor(r, voters))!.push(r);
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
