import { type CandyLine, isNewLine, LINES, lineSpriteUrl } from "./lines";

export const TIER_STYLES = ["standard", "fixed", "consensus"] as const;
export type TierStyle = typeof TIER_STYLES[number];
export const TIER_STYLE_LABEL: Record<TierStyle, string> = {
  standard: "Percentile", fixed: "Fixed Scores", consensus: "Consensus",
};
/**
 * Fixed Scores cutoffs: quarters of the 0-100 score (all-Neutral is 0, in C;
 * below 0 is Avoid). A score of 75 is as good as three in four players wanting
 * it and the rest Neutral.
 */
export const FIXED_SCORE_CUTOFFS = { S: 75, A: 50, B: 25 } as const;
export const TIER_STYLE_DESCRIPTION: Record<TierStyle, string> = {
  standard: "Best for choosing priorities within this group. Positive scores are ranked against each other: S is the top 10%, A the next 20%, B the next 30%, C the rest. Ties stay together, so tier sizes can vary. Zero scores go to C; negative scores go to F.",
  fixed: `Best for comparing scores across groups and over time. Scores below 0 go to F; the rest are placed by their own score: S ${FIXED_SCORE_CUTOFFS.S}–100, A ${FIXED_SCORE_CUTOFFS.A}–${FIXED_SCORE_CUTOFFS.S - 1}, B ${FIXED_SCORE_CUTOFFS.B}–${FIXED_SCORE_CUTOFFS.A - 1}, C 0–${FIXED_SCORE_CUTOFFS.B - 1}. The same score cutoffs apply to every group.`,
  consensus: "Best for seeing agreement and disagreement. Groups candy as Mostly Wanted, Mixed, or Mostly Unwanted. Divisive requires at least one-third Want and one-third Don't Want.",
};
export const parseTierStyle = (value: unknown): TierStyle =>
  TIER_STYLES.includes(value as TierStyle) ? value as TierStyle : "standard";
export const CONSENSUS_COLORS: Record<string, { bg: string; fg: string; shadow: string }> = {
  S: { bg: "#3fb86b", fg: "#ffffff", shadow: "#2b874c" }, A: { bg: "#ffd24d", fg: "#5b3e00", shadow: "#c99c21" },
  B: { bg: "#8a97ab", fg: "#ffffff", shadow: "#626f83" }, C: { bg: "#ffb36b", fg: "#5b3e00", shadow: "#d08743" },
  avoid: { bg: "#ec6b6b", fg: "#ffffff", shadow: "#ba4848" },
};


/** Everyone pool: players who've seen a candy before it's ranked (counts show from the database's 10). */
export const RANK_MIN_SEEN = 50;

export type TierId = "top" | "S" | "A" | "B" | "C" | "avoid";

export interface Tier {
  id: TierId;
  label: string;
  hint: string;
}

/**
 * The tier list answers "which candy should I send my friends?". You send one
 * candy a day to every friend, so a candy is worth what it's worth to each
 * of them: Want full value, Neutral a third ("collect it slowly"), Don't Want
 * nothing. Shifted so Neutral is 0, that's POINTS: Want +1, Neutral 0, Don't
 * Want -1/2. Support is the score per player who has seen the candy, so a new
 * release isn't marked down for players who haven't got to it yet.
 * Top 3 Spotlight stars don't change the score; they're the first tie-breaker.
 *
 * Negative net support is Avoid; zero support stays in C. Positive scores are
 * ranked, and the top
 * TIER_SHARES.S go to S, the next TIER_SHARES.A to A, the next TIER_SHARES.B to B, the rest to C (10 / 20 / 30 / 40%: a short S to send first). Lines
 * that tie share a tier, placed by the tie's middle rank (the best-ranked tie
 * is always S). With no voters at all, everything is C.
 *
 * Above S, the Top 3 Spotlight row repeats every line the pool starred, most stars
 * first, Avoid lines included (nobody's pick is left out). The board shows the
 * first TOP_ROW_SIZE and folds the rest behind "Show all". They also stay in their regular tier, so
 * the rest of the list never shifts.
 */
export const TIER_SHARES = { S: 0.1, A: 0.2, B: 0.3 } as const;

/** How many of the most-starred lines the Top 3 Spotlight row shows before "Show all". */
export const TOP_ROW_SIZE = 9;

/** What each voter's choice adds to a line's score. Tier List only; match %s use public.dont_want_weight(). */
export const POINTS = { want: 1, neutral: 0, dontWant: -0.5 } as const;

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
  // Same shape as Fixed Scores' "Score 75–100" hints; F's hint is shared by both.
  { id: "S", label: "S", hint: `Top ${pct(TIER_SHARES.S)}% of positive scores` },
  { id: "A", label: "A", hint: `Next ${pct(TIER_SHARES.A)}% of positive scores` },
  { id: "B", label: "B", hint: `Next ${pct(TIER_SHARES.B)}% of positive scores` },
  { id: "C", label: "C", hint: "Remaining positive scores and all zero scores" },
  { id: "avoid", label: "F", hint: "More than twice as many Don't Want votes as Want votes (score below 0)" },
];

/** Labels follow the selected presentation and its score boundaries. */
export function tierDefinitions(style: TierStyle): Tier[] {
  if (style === "consensus") return [
    TIERS[0],
    { id: "S", label: "Mostly\nWanted", hint: "Want is the largest group, with at least twice as many Want as Don't Want" },
    { id: "A", label: "Mixed", hint: "No clear recommendation; includes divided and mostly Neutral votes" },
    { id: "avoid", label: "Mostly\nUnwanted", hint: "Don't Want is the largest group, with at least twice as many Don't Want as Want" },
  ];
  if (style === "standard") return TIERS;
  return TIERS.map((tier) => ({ ...tier, hint: ({
    S: `Score ${FIXED_SCORE_CUTOFFS.S}–100`,
    A: `Score ${FIXED_SCORE_CUTOFFS.A}–${FIXED_SCORE_CUTOFFS.S - 1}`,
    B: `Score ${FIXED_SCORE_CUTOFFS.B}–${FIXED_SCORE_CUTOFFS.A - 1}`,
    C: `Score 0–${FIXED_SCORE_CUTOFFS.B - 1}`,
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
  /** Score (see scoreOf). */
  score: number;
  /** Score per 100 players who've seen it: what tiers rank on. All Want +100, all Neutral 0, all Don't Want -50. */
  support: number | null;
  /** Released within NEW_LINE_DAYS: shown with the "new" border. */
  isNew: boolean;
  /** Detail preserved within Consensus's shared Mixed group. */
  consensusNote?: "Divisive" | "Mostly Neutral";
  tops: number;
  /**
   * Share of the pool who want it, 0 to 1, stars not weighted. Null with no
   * voters (the board shows the score only when someone has voted).
   */
  wantShare: number | null;
  /** Share of the pool who don't want it. Null with no voters. */
  dontShare: number | null;
}

/** Who a line's score is out of: the players who've seen it (Everyone), else the whole pool (My Friends). */
export const seenOf = (votes: LineVotes | undefined, voters: number): number => votes?.seen ?? voters;

/** A line's score: POINTS per voter, everyone not voting Want or Don't Want counting as Neutral. */
export function scoreOf(votes: LineVotes, voters: number): number {
  const neutral = Math.max(0, voters - votes.wants - votes.dontWants);
  return POINTS.want * votes.wants + POINTS.neutral * neutral + POINTS.dontWant * votes.dontWants;
}

/** Normalize net support to pool size without rounding tier boundaries. */
export function supportOf(score: number, voters: number): number | null {
  return voters > 0 ? 100 * score / voters : null;
}

/** "79/100" for ranked scores, a bare "−42" below 0 (Avoid). Sorting and tier boundaries keep exact scores. */
export const formatScore = (support: number): string => support < 0 ? formatSupport(support) : `${formatSupport(support)}/100`;

/**
 * Whole-number labels only; sorting and tier boundaries retain exact support.
 * Rounds toward 0, so a 74.6 in A reads 74 (A is 50–74), never 75.
 */
export function formatSupport(support: number): string {
  if (support === 0) return "0";
  const magnitude = Math.floor(Math.abs(support));
  return (support < 0 ? "−" : "") + (magnitude === 0 ? "<1" : magnitude.toString());
}

const supportKey = (r: RankedLine) => r.support ?? -Infinity;
/** Where a tier's share ends: ceil(share * n), minus float noise (0.1 + 0.2 + 0.3 is 0.6000000000000001). */
const shareEnd = (share: number, n: number) => Math.ceil(Math.round(share * n * 1e9) / 1e9);
const byRank = (a: RankedLine, b: RankedLine) =>
  supportKey(b) - supportKey(a) ||
  b.tops - a.tops ||
  Number(b.line.rare) - Number(a.line.rare) ||
  a.dontWants - b.dontWants ||
  a.line.dex - b.line.dex;

/**
 * Buckets lines into tiers (see TIER_SHARES), best first inside each tier (support,
 * then Top 3 Spotlight stars, then rare lines, then fewer don't-wants, then dex). Lines that tie on score share a tier whatever their stars. The Top 3 Spotlight row
 * holds every starred line, ordered by stars and then the same keys.
 */
export function buildTiers(
  votes: Map<string, LineVotes>,
  voters: number,
  lines: CandyLine[] = LINES,
  style: TierStyle = "standard",
  now: Date = new Date(),
): Map<TierId, RankedLine[]> {
  const all: RankedLine[] = lines.map((line) => {
    const v = votes.get(line.id) ?? { wants: 0, dontWants: 0 };
    const seen = seenOf(v, voters);
    const score = scoreOf(v, seen);
    return {
      line,
      wants: v.wants,
      dontWants: v.dontWants,
      neutral: Math.max(0, seen - v.wants - v.dontWants),
      score,
      support: supportOf(score, seen),
      isNew: isNewLine(line, now),
      tops: v.tops ?? 0,
      wantShare: seen > 0 ? v.wants / seen : null,
      dontShare: seen > 0 ? v.dontWants / seen : null,
    };
  });
  const top = all
    .filter((r) => r.tops > 0)
    .sort((a, b) => b.tops - a.tops || byRank(a, b));
  const out = new Map<TierId, RankedLine[]>(TIERS.map((t) => [t.id, []]));
  out.set("top", top);
  // Nobody has voted: nothing to rank, so everything is C.
  if (voters <= 0) {
    out.get(style === "consensus" ? "A" : "C")!.push(...all.sort(byRank));
    return out;
  }
  if (style === "consensus") {
    for (const row of all.sort(byRank)) {
      const seen = Math.max(1, row.wants + row.neutral + row.dontWants);
      const want = row.wants / seen, dont = row.dontWants / seen, neutral = row.neutral / seen;
      // Both opposing groups must each cover at least one-third of those who've seen it.
      const divisive = row.wants * 3 >= seen && row.dontWants * 3 >= seen;
      const bucket: TierId = divisive ? "A"
        : want > neutral && want > dont && want >= 2 * dont ? "S"
        : dont > neutral && dont > want && dont >= 2 * want ? "avoid" : "A";
      if (bucket === "A") row.consensusNote = divisive ? "Divisive" : neutral >= 0.5 ? "Mostly Neutral" : undefined;
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

  // Positive support fills S/A/B/C by rank; zero support stays in C. A run of lines tied on support all go to
  // the tier of the run's middle position, so with few voters (lots of ties)
  // tier sizes stay near their targets instead of one tie swallowing S.
  out.get("C")!.push(...all.filter((r) => r.score === 0));
  const ranked = all.filter((r) => r.score > 0).sort(byRank);
  const n = ranked.length;
  const ends: [Exclude<TierId, "top" | "avoid">, number][] = [
    ["S", shareEnd(TIER_SHARES.S, n)],
    ["A", shareEnd(TIER_SHARES.S + TIER_SHARES.A, n)],
    ["B", shareEnd(TIER_SHARES.S + TIER_SHARES.A + TIER_SHARES.B, n)],
    ["C", n],
  ];
  for (let start = 0; start < n; ) {
    let end = start;
    while (end + 1 < n && ranked[end + 1].support === ranked[start].support) end++;
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

/** A public line not ranked yet: its counts once the database shows them (10+ players), else none. */
export interface UnrankedLine {
  line: CandyLine;
  sprite?: string;
  isNew: boolean;
  counts?: { wants: number; neutral: number; dontWants: number; seen: number };
}

/**
 * Everyone pool: only lines seen by RANK_MIN_SEEN players are ranked (and
 * starred). Below that, ranking is still being determined; the database
 * already hides counts under 10 players, and those lines carry no numbers.
 */
export function buildPublicTiers(votes: Map<string, LineVotes>, voters: number, lines: CandyLine[] = LINES, style: TierStyle = "standard", now: Date = new Date()) {
  const eligible = lines.filter((line) => (votes.get(line.id)?.seen ?? 0) >= RANK_MIN_SEEN);
  const ids = new Set(eligible.map((line) => line.id));
  return {
    tiers: buildTiers(votes, voters, eligible, style, now),
    unranked: lines.filter((line) => !ids.has(line.id)).map((line): UnrankedLine => {
      const v = votes.get(line.id);
      return {
        line,
        isNew: isNewLine(line, now),
        ...(v?.seen != null && { counts: { wants: v.wants, dontWants: v.dontWants, neutral: Math.max(0, v.seen - v.wants - v.dontWants), seen: v.seen } }),
      };
    }),
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
