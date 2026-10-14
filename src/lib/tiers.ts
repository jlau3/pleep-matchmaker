import { type CandyLine, LINES, lineSpriteUrl } from "./lines";

export type TierId = "top" | "S" | "A" | "B" | "C" | "avoid";

export interface Tier {
  id: TierId;
  label: string;
  hint: string;
}

/**
 * The tier list answers "which candy should I send my friends?". Each voter
 * scores a line (POINTS): Want +3, Neutral +1 (players use it for "don't
 * mind", so it's mild support; it also covers lines they haven't voted on),
 * Don't Want -3. Since Neutral is everyone else, that ranks the same as wants
 * minus 2 x don't-wants: one Don't Want cancels two Wants. Top 3 stars don't
 * change the score; they're the first tie-breaker.
 *
 * Below 0 is Avoid: the Don't Wants outweigh the Wants plus a third of the
 * Neutrals. Every other line is ranked, and the top TIER_SHARES.S go to S, the
 * next TIER_SHARES.A to A, the next TIER_SHARES.B to B, the rest to C. Lines
 * that tie share a tier, placed by the tie's middle rank (the best-ranked tie
 * is always S). With no voters at all, everything is C.
 *
 * Above S, the Top 3 row repeats every line the pool starred, most stars
 * first, Avoid lines included (nobody's pick is left out). The board shows the
 * first TOP_ROW_SIZE and folds the rest behind "Show all". They also stay in their regular tier, so
 * the rest of the list never shifts.
 */
export const TIER_SHARES = { S: 0.2, A: 0.25, B: 0.3 } as const;

/** How many of the most-starred lines the Top 3 row shows before "Show all". */
export const TOP_ROW_SIZE = 9;

/** What each voter's choice adds to a line's score. Tier List only; match %s use public.dont_want_weight(). */
export const POINTS = { want: 3, neutral: 1, dontWant: -3 } as const;

const pct = (x: number) => Math.round(x * 100);

export const TIERS: Tier[] = [
  { id: "top", label: "Top 3", hint: "players' favorites, not part of the ranking" },
  { id: "S", label: "S", hint: `top ${pct(TIER_SHARES.S)}% most wanted` },
  { id: "A", label: "A", hint: `next ${pct(TIER_SHARES.A)}%` },
  { id: "B", label: "B", hint: `next ${pct(TIER_SHARES.B)}%` },
  { id: "C", label: "C", hint: "the rest" },
  { id: "avoid", label: "Avoid", hint: "Don't Wants outweigh the Wants and don't-minds" },
];

export interface LineVotes {
  wants: number;
  dontWants: number;
  /** Players who starred it as one of their Top 3 (a subset of wants). */
  tops?: number;
}

export interface RankedLine {
  line: CandyLine;
  /** Sprite to show instead of the namesake's, e.g. Cleffa when filtering to Slumbering. */
  sprite?: string;
  wants: number;
  dontWants: number;
  /** Voters in the pool who neither want nor don't want it (Neutral, or not voted yet). */
  neutral: number;
  /** Score (see scoreOf); what tiers rank on. */
  score: number;
  /**
   * The score shown out of 100 (see ratingOf): 0 when the whole pool doesn't
   * want it, 50 at the Avoid line, 67 when everyone's neutral, 100 when
   * everyone wants it. Null with no voters.
   */
  rating: number | null;
  tops: number;
  /**
   * Share of the pool who want it, 0 to 1, stars not weighted. Null with no
   * voters (the board shows the score only when someone has voted).
   */
  wantShare: number | null;
  /** Share of the pool who don't want it. Null with no voters. */
  dontShare: number | null;
}

/** A line's score: POINTS per voter, everyone not voting Want or Don't Want counting as Neutral. */
export function scoreOf(votes: LineVotes, voters: number): number {
  const neutral = Math.max(0, voters - votes.wants - votes.dontWants);
  return POINTS.want * votes.wants + POINTS.neutral * neutral + POINTS.dontWant * votes.dontWants;
}

/**
 * Score as a 0-100 rating, from everyone's Don't Want (0) to everyone's Want
 * (100); 50 is the Avoid line. Same order as the score within a pool, so it
 * never changes the ranking.
 */
export function ratingOf(score: number, voters: number): number | null {
  if (voters <= 0) return null;
  const span = POINTS.want - POINTS.dontWant;
  const floor = POINTS.dontWant * voters;
  return Math.min(100, Math.max(0, Math.round((100 * (score - floor)) / (span * voters))));
}

const byRank = (a: RankedLine, b: RankedLine) =>
  b.score - a.score ||
  b.tops - a.tops ||
  b.line.weight - a.line.weight ||
  a.dontWants - b.dontWants ||
  a.line.dex - b.line.dex;

/**
 * Buckets lines into tiers (see TIER_SHARES), best first inside each tier (score,
 * then Top 3 stars, then rarity weight, then fewer don't-wants, then
 * dex). Lines that tie on score share a tier whatever their stars. The Top 3 row
 * holds every starred line, ordered by stars and then the same keys.
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
      neutral: Math.max(0, voters - v.wants - v.dontWants),
      score: scoreOf(v, voters),
      rating: ratingOf(scoreOf(v, voters), voters),
      tops: v.tops ?? 0,
      wantShare: voters > 0 ? v.wants / voters : null,
      dontShare: voters > 0 ? v.dontWants / voters : null,
    };
  });
  const top = all
    .filter((r) => r.tops > 0)
    .sort((a, b) => b.tops - a.tops || byRank(a, b));
  const out = new Map<TierId, RankedLine[]>(TIERS.map((t) => [t.id, []]));
  out.set("top", top);
  // Nobody has voted: nothing to rank, so everything is C.
  if (voters <= 0) {
    out.get("C")!.push(...all.sort(byRank));
    return out;
  }
  for (const r of all) if (r.score < 0) out.get("avoid")!.push(r);

  // Lines at 0 or above fill S/A/B/C by rank. A run of lines tied on score all go to
  // the tier of the run's middle position, so with few voters (lots of ties)
  // tier sizes stay near their targets instead of one tie swallowing S.
  const ranked = all.filter((r) => r.score >= 0).sort(byRank);
  const n = ranked.length;
  const ends: [Exclude<TierId, "top" | "avoid">, number][] = [
    ["S", Math.ceil(TIER_SHARES.S * n)],
    ["A", Math.ceil((TIER_SHARES.S + TIER_SHARES.A) * n)],
    ["B", Math.ceil((TIER_SHARES.S + TIER_SHARES.A + TIER_SHARES.B) * n)],
    ["C", n],
  ];
  for (let start = 0; start < n; ) {
    let end = start;
    while (end + 1 < n && ranked[end + 1].score === ranked[start].score) end++;
    const mid = Math.floor((start + end) / 2);
    // The best-ranked run is always S, so S is never empty (e.g. one friend's wants all tie).
    const tier = start === 0 ? "S" : ends.find(([, e]) => mid < e)![0];
    for (let i = start; i <= end; i++) out.get(tier)!.push(ranked[i]);
    start = end + 1;
  }

  for (const [id, rows] of out) {
    if (id !== "top") rows.sort(byRank);
  }
  return out;
}

/** The sprite a tier list shows for a line: the filtered form when there is one, else the namesake. */
export const rankedSpriteUrl = (ranked: RankedLine) => ranked.sprite ?? lineSpriteUrl(ranked.line);

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
