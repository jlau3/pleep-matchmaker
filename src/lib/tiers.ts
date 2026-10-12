import { type CandyLine, LINES } from "./lines";

export type TierId = "S" | "A" | "B" | "C" | "avoid" | "none";

export interface Tier {
  id: TierId;
  label: string;
  hint: string;
}

/**
 * Ranking is by net votes (wants minus don't-wants) as a share of the voters
 * in the pool, so a candy that splits the room ranks below one nobody minds.
 */
export const TIER_CUTOFFS = { S: 0.6, A: 0.35, B: 0.15 } as const;

export const TIERS: Tier[] = [
  { id: "S", label: "S", hint: `${TIER_CUTOFFS.S * 100}%+ net want it` },
  { id: "A", label: "A", hint: `${TIER_CUTOFFS.A * 100}–${TIER_CUTOFFS.S * 100 - 1}%` },
  { id: "B", label: "B", hint: `${TIER_CUTOFFS.B * 100}–${TIER_CUTOFFS.A * 100 - 1}%` },
  { id: "C", label: "C", hint: `under ${TIER_CUTOFFS.B * 100}%` },
  { id: "avoid", label: "Avoid", hint: "more don't want it than want it" },
  { id: "none", label: "No votes", hint: "nobody has an opinion yet" },
];

export interface LineVotes {
  wants: number;
  dontWants: number;
}

export interface RankedLine {
  line: CandyLine;
  wants: number;
  dontWants: number;
  /** Voters in the pool who neither want nor don't want it (undecided or skipped). */
  unsure: number;
  net: number;
}

export function tierFor(votes: LineVotes, voters: number): TierId {
  const net = votes.wants - votes.dontWants;
  if (net < 0) return "avoid";
  if (net === 0 || voters === 0) return "none";
  const share = net / voters;
  if (share >= TIER_CUTOFFS.S) return "S";
  if (share >= TIER_CUTOFFS.A) return "A";
  if (share >= TIER_CUTOFFS.B) return "B";
  return "C";
}

/** Buckets lines into tiers, best first inside each tier (net, then wants, then dex). */
export function buildTiers(
  votes: Map<string, LineVotes>,
  voters: number,
  lines: CandyLine[] = LINES,
): Map<TierId, RankedLine[]> {
  const out = new Map<TierId, RankedLine[]>(TIERS.map((t) => [t.id, []]));
  for (const line of lines) {
    const v = votes.get(line.id) ?? { wants: 0, dontWants: 0 };
    out.get(tierFor(v, voters))!.push({
      line,
      wants: v.wants,
      dontWants: v.dontWants,
      unsure: Math.max(0, voters - v.wants - v.dontWants),
      net: v.wants - v.dontWants,
    });
  }
  for (const ranked of out.values()) {
    ranked.sort((a, b) => b.net - a.net || b.wants - a.wants || a.line.dex - b.line.dex);
  }
  return out;
}

/** Vote counts per line from a set of players' want / don't-want lists. */
export function countVotes(players: { wants: string[]; dont_wants: string[] }[]): Map<string, LineVotes> {
  const votes = new Map<string, LineVotes>();
  const get = (id: string) => {
    let v = votes.get(id);
    if (!v) votes.set(id, (v = { wants: 0, dontWants: 0 }));
    return v;
  };
  for (const p of players) {
    for (const id of new Set(p.wants)) get(id).wants++;
    for (const id of new Set(p.dont_wants)) get(id).dontWants++;
  }
  return votes;
}
