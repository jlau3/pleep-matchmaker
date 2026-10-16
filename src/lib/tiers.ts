import { type CandyLine, LINES, lineSpriteUrl } from "./lines";

export const TIER_STYLES = ["standard", "fixed", "percentile", "consensus"] as const;
export type TierStyle = typeof TIER_STYLES[number];
export const TIER_STYLE_LABEL: Record<TierStyle, string> = {
  standard: "Standard", fixed: "Fixed Scores", percentile: "Percentile Only", consensus: "Consensus",
};
export const TIER_STYLE_DESCRIPTION: Record<TierStyle, string> = {
  standard: "Recommended shared ranking. Negative totals go to Avoid; the rest split by percentile within your filters.",
  fixed: "Uses fixed score cutoffs. A candy keeps its tier when filters change. Some tiers may be empty.",
  percentile: "Ranks all candy by percentile, including negative scores. Shows relative priorities without an Avoid cutoff.",
  consensus: "Groups candy by Want, Neutral, and Don't Want percentages, including a Divisive group. These are categories, not S–C ranks.",
};
export const parseTierStyle = (value: unknown): TierStyle =>
  TIER_STYLES.includes(value as TierStyle) ? value as TierStyle : "standard";
export const CONSENSUS_COLORS: Record<string, { bg: string; fg: string }> = {
  S: { bg: "#3fb86b", fg: "#ffffff" }, A: { bg: "#ffd24d", fg: "#5b3e00" },
  B: { bg: "#8a97ab", fg: "#ffffff" }, C: { bg: "#ffb36b", fg: "#5b3e00" },
  avoid: { bg: "#ec6b6b", fg: "#ffffff" },
};

/** Cutoffs use the displayed 0–100 rating. All-Neutral (67) belongs in B. */
export const FIXED_SCORE_CUTOFFS = { S: 90, A: 80, B: 67 } as const;

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

/** Each tier's colours on the Tier List (and its letter badges elsewhere). */
export const TIER_STYLE: Record<string, string> = {
  top: "bg-gradient-to-br from-sun to-[#ff8fab] text-[#5b3e00] shadow-[0_3px_0_var(--color-sun-deep)]",
  S: "bg-[#ff8fab] text-white shadow-[0_3px_0_#e0607f]",
  A: "bg-[#ffb36b] text-white shadow-[0_3px_0_#e08a3a]",
  B: "bg-sun text-[#5b3e00] shadow-[0_3px_0_var(--color-sun-deep)]",
  C: "bg-[#a8dd7a] text-[#2f5a12] shadow-[0_3px_0_#7cba4c]",
  avoid: "bg-meh text-white shadow-[0_3px_0_#6b778a]",
};


export const TIERS: Tier[] = [
  { id: "top", label: "Top 3", hint: "Players' Top 3, separate from the ranking" },
  { id: "S", label: "S", hint: `Top ${pct(TIER_SHARES.S)}% most wanted` },
  { id: "A", label: "A", hint: `Next ${pct(TIER_SHARES.A)}%` },
  { id: "B", label: "B", hint: `Next ${pct(TIER_SHARES.B)}%` },
  { id: "C", label: "C", hint: "The rest" },
  { id: "avoid", label: "Avoid", hint: "Don't Want votes outweigh support from Want and Neutral" },
];

/** Labels follow the selected presentation; the shared default stays unchanged. */
export function tierDefinitions(style: TierStyle): Tier[] {
  if (style === "consensus") return [
    TIERS[0],
    { id: "S", label: "Mostly\nWanted", hint: "At least 50% Want and fewer than 25% Don't Want" },
    { id: "B", label: "Mostly\nNeutral", hint: "At least 50% Neutral, after checking the stronger preference groups" },
    { id: "A", label: "Mixed", hint: "No majority and fewer than 25% on at least one opposing side" },
    { id: "C", label: "Divisive", hint: "At least 25% Want and at least 25% Don't Want" },
    { id: "avoid", label: "Mostly\nUnwanted", hint: "At least 50% Don't Want and fewer than 25% Want" },
  ];
  if (style === "percentile") return TIERS.filter((tier) => tier.id !== "avoid");
  if (style === "standard") return TIERS;
  return TIERS.map((tier) => ({ ...tier, hint: ({
    S: `${FIXED_SCORE_CUTOFFS.S}–100/100`,
    A: `${FIXED_SCORE_CUTOFFS.A}–${FIXED_SCORE_CUTOFFS.S - 1}/100`,
    B: `${FIXED_SCORE_CUTOFFS.B}–${FIXED_SCORE_CUTOFFS.A - 1}/100 · All-Neutral scores ${FIXED_SCORE_CUTOFFS.B}`,
    C: `Below ${FIXED_SCORE_CUTOFFS.B}/100, with a nonnegative vote total`,
  } as Record<string, string>)[tier.id] ?? tier.hint }));
}

export interface LineVotes {
  wants: number;
  dontWants: number;
  /** Players who starred it as one of their Top 3 (a subset of wants). */
  tops?: number;
  /** Everyone pool only: active voters who've seen the line (any vote, Neutral included; get_line_stats). */
  seen?: number;
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
  Number(b.line.rare) - Number(a.line.rare) ||
  a.dontWants - b.dontWants ||
  a.line.dex - b.line.dex;

/**
 * Buckets lines into tiers (see TIER_SHARES), best first inside each tier (score,
 * then Top 3 stars, then rare lines, then fewer don't-wants, then dex). Lines that tie on score share a tier whatever their stars. The Top 3 row
 * holds every starred line, ordered by stars and then the same keys.
 */
export function buildTiers(
  votes: Map<string, LineVotes>,
  voters: number,
  lines: CandyLine[] = LINES,
  style: TierStyle = "standard",
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
  if (style === "consensus") {
    for (const row of all.sort(byRank)) {
      const want = row.wants / voters, dont = row.dontWants / voters, neutral = row.neutral / voters;
      const bucket: TierId = want >= 0.25 && dont >= 0.25 ? "C"
        : want >= 0.5 && dont < 0.25 ? "S"
        : dont >= 0.5 && want < 0.25 ? "avoid"
        : neutral >= 0.5 ? "B" : "A";
      out.get(bucket)!.push(row);
    }
    return out;
  }
  if (style !== "percentile") for (const r of all) if (r.score < 0) out.get("avoid")!.push(r);

  if (style === "fixed") {
    for (const row of all.filter((r) => r.score >= 0).sort(byRank)) {
      const rating = row.rating!;
      const tier = rating >= FIXED_SCORE_CUTOFFS.S ? "S"
        : rating >= FIXED_SCORE_CUTOFFS.A ? "A"
        : rating >= FIXED_SCORE_CUTOFFS.B ? "B" : "C";
      out.get(tier)!.push(row);
    }
    out.get("avoid")!.sort(byRank);
    return out;
  }

  // Lines at 0 or above fill S/A/B/C by rank. A run of lines tied on score all go to
  // the tier of the run's middle position, so with few voters (lots of ties)
  // tier sizes stay near their targets instead of one tie swallowing S.
  const ranked = all.filter((r) => style === "percentile" || r.score >= 0).sort(byRank);
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
export const rankedSpriteUrl = (ranked: Pick<RankedLine, "line" | "sprite">) => ranked.sprite ?? lineSpriteUrl(ranked.line);

/** Public lines below the database threshold stay out of every ranking and star row. */
export function buildPublicTiers(votes: Map<string, LineVotes>, voters: number, lines: CandyLine[] = LINES, style: TierStyle = "standard") {
  const eligible = lines.filter((line) => (votes.get(line.id)?.seen ?? 0) >= 10);
  const ids = new Set(eligible.map((line) => line.id));
  return {
    tiers: buildTiers(votes, voters, eligible, style),
    unranked: lines.filter((line) => !ids.has(line.id)).map((line): Pick<RankedLine, "line" | "sprite"> => ({ line })),
  };
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
