import { type CandyLine, LINES, lineSpriteUrl } from "./lines";

export const TIER_STYLES = ["standard", "fixed", "consensus"] as const;
export type TierStyle = typeof TIER_STYLES[number];
export const TIER_STYLE_LABEL: Record<TierStyle, string> = {
  standard: "Standard", fixed: "Fixed Scores", consensus: "Consensus",
};
export const TIER_STYLE_DESCRIPTION: Record<TierStyle, string> = {
  standard: "Recommended shared ranking. Negative totals go to Avoid; the rest split by percentile.",
  fixed: "Compare support across lists using the same score cutoffs. Tiers depend on each candy's votes, not how other candy scores.",
  consensus: "Groups candy by Want, Neutral, and Don't Want percentages, including a Divisive group.",
};
export const parseTierStyle = (value: unknown): TierStyle =>
  TIER_STYLES.includes(value as TierStyle) ? value as TierStyle : "standard";
export const CONSENSUS_COLORS: Record<string, { bg: string; fg: string; shadow: string }> = {
  S: { bg: "#3fb86b", fg: "#ffffff", shadow: "#2b874c" }, A: { bg: "#ffd24d", fg: "#5b3e00", shadow: "#c99c21" },
  B: { bg: "#8a97ab", fg: "#ffffff", shadow: "#626f83" }, C: { bg: "#ffb36b", fg: "#5b3e00", shadow: "#d08743" },
  avoid: { bg: "#ec6b6b", fg: "#ffffff", shadow: "#ba4848" },
};

/** Trial benchmarks on net support per 100 players; all-Neutral is 0 in C. */
export const FIXED_SCORE_CUTOFFS = { S: 80, A: 50, B: 20 } as const;

export type TierId = "top" | "S" | "A" | "B" | "C" | "avoid";

export interface Tier {
  id: TierId;
  label: string;
  hint: string;
}

/**
 * The tier list answers "which candy should I send my friends?". Each voter
 * scores a candy (POINTS): Want +1, Neutral 0, Don't Want -2.
 * This preserves the previous ordering: one Don't Want offsets two Wants.
 * Top 3 Spotlight stars don't change the score; they're the first tie-breaker.
 *
 * Negative net support is Avoid; zero support stays in C. Positive scores are
 * ranked, and the top
 * TIER_SHARES.S go to S, the next TIER_SHARES.A to A, the next TIER_SHARES.B to B, the rest to C. Lines
 * that tie share a tier, placed by the tie's middle rank (the best-ranked tie
 * is always S). With no voters at all, everything is C.
 *
 * Above S, the Top 3 Spotlight row repeats every line the pool starred, most stars
 * first, Avoid lines included (nobody's pick is left out). The board shows the
 * first TOP_ROW_SIZE and folds the rest behind "Show all". They also stay in their regular tier, so
 * the rest of the list never shifts.
 */
export const TIER_SHARES = { S: 0.2, A: 0.25, B: 0.3 } as const;

/** How many of the most-starred lines the Top 3 Spotlight row shows before "Show all". */
export const TOP_ROW_SIZE = 9;

/** What each voter's choice adds to a line's score. Tier List only; match %s use public.dont_want_weight(). */
export const POINTS = { want: 1, neutral: 0, dontWant: -2 } as const;

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
  { id: "top", label: "Top 3\nSpotlight", hint: "Candy players most want friends to send" },
  { id: "S", label: "S", hint: `Top ${pct(TIER_SHARES.S)}% most wanted` },
  { id: "A", label: "A", hint: `Next ${pct(TIER_SHARES.A)}%` },
  { id: "B", label: "B", hint: `Next ${pct(TIER_SHARES.B)}%` },
  { id: "C", label: "C", hint: "Lower priority" },
  { id: "avoid", label: "Avoid", hint: "Negative net support" },
];

/** Labels follow the selected presentation and its score boundaries. */
export function tierDefinitions(style: TierStyle): Tier[] {
  if (style === "consensus") return [
    TIERS[0],
    { id: "S", label: "Mostly\nWanted", hint: "At least 50% Want and fewer than 25% Don't Want" },
    { id: "B", label: "Mostly\nNeutral", hint: "At least 50% Neutral, after checking the stronger preference groups" },
    { id: "A", label: "Mixed", hint: "No majority and fewer than 25% on at least one opposing side" },
    { id: "C", label: "Divisive", hint: "At least 25% Want and at least 25% Don't Want" },
    { id: "avoid", label: "Mostly\nUnwanted", hint: "At least 50% Don't Want and fewer than 25% Want" },
  ];
  if (style === "standard") return TIERS;
  return TIERS.map((tier) => ({ ...tier, hint: ({
    S: `Net support +${FIXED_SCORE_CUTOFFS.S} or higher`,
    A: `Net support +${FIXED_SCORE_CUTOFFS.A} to below +${FIXED_SCORE_CUTOFFS.S}`,
    B: `Net support +${FIXED_SCORE_CUTOFFS.B} to below +${FIXED_SCORE_CUTOFFS.A}`,
    C: `Lower priority · Net support 0 to below +${FIXED_SCORE_CUTOFFS.B}`,
  } as Record<string, string>)[tier.id] ?? tier.hint }));
}

export interface LineVotes {
  wants: number;
  dontWants: number;
  /** Players who starred it as one of their Top 3 Spotlight (a subset of wants). */
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
  /** Net support per 100 players: Neutral 0, all Want +100, all Don't Want -200. */
  support: number | null;
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

/** Normalize net support to pool size without rounding tier boundaries. */
export function supportOf(score: number, voters: number): number | null {
  return voters > 0 ? 100 * score / voters : null;
}

/** Keep nearby scores distinguishable, and never display negative support as zero. */
export function formatSupport(support: number): string {
  if (support === 0) return "0";
  const sign = support > 0 ? "+" : "−";
  const magnitude = Math.abs(support);
  return sign + (magnitude < 0.05 ? "<0.1" : magnitude.toFixed(1).replace(/\.0$/, ""));
}

const byRank = (a: RankedLine, b: RankedLine) =>
  b.score - a.score ||
  b.tops - a.tops ||
  Number(b.line.rare) - Number(a.line.rare) ||
  a.dontWants - b.dontWants ||
  a.line.dex - b.line.dex;

/**
 * Buckets lines into tiers (see TIER_SHARES), best first inside each tier (score,
 * then Top 3 Spotlight stars, then rare lines, then fewer don't-wants, then dex). Lines that tie on score share a tier whatever their stars. The Top 3 Spotlight row
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
      support: supportOf(scoreOf(v, voters), voters),
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
  for (const r of all) if (r.score < 0) out.get("avoid")!.push(r);

  if (style === "fixed") {
    for (const row of all.filter((r) => r.score >= 0).sort(byRank)) {
      const support = row.support!;
      const tier = support >= FIXED_SCORE_CUTOFFS.S ? "S"
        : support >= FIXED_SCORE_CUTOFFS.A ? "A"
        : support >= FIXED_SCORE_CUTOFFS.B ? "B" : "C";
      out.get(tier)!.push(row);
    }
    out.get("avoid")!.sort(byRank);
    return out;
  }

  // Positive scores fill S/A/B/C by rank; zero support stays in C. A run of lines tied on score all go to
  // the tier of the run's middle position, so with few voters (lots of ties)
  // tier sizes stay near their targets instead of one tie swallowing S.
  out.get("C")!.push(...all.filter((r) => r.score === 0));
  const ranked = all.filter((r) => r.score > 0).sort(byRank);
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
