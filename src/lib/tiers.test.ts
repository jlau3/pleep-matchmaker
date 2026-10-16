import { describe, expect, it } from "vitest";
import { LINES_BY_ID } from "./lines";
import { buildTiers, countVotes, supportOf, formatSupport, scoreOf, TOP_ROW_SIZE } from "./tiers";

/** n lines where line i has i+1 wants from n voters, so every score is distinct. */
function ladder(n: number) {
  const lines = [...LINES_BY_ID.values()].slice(0, n);
  const votes = new Map(lines.map((line, i) => [line.id, { wants: i + 1, dontWants: 0 }]));
  return { lines, votes };
}

const ids = (tiers: Map<string, { line: { id: string } }[]>, tier: string) => tiers.get(tier)!.map((r) => r.line.id);

describe("scoreOf", () => {
  it("counts Want +1, Neutral 0, Don't Want -2", () => {
    expect(scoreOf({ wants: 10, dontWants: 4 }, 20)).toBe(10 - 8);
    expect(scoreOf({ wants: 0, dontWants: 0 }, 20)).toBe(0); // all neutral, or nobody voted on it
    // One Don't Want cancels two Wants: these two tie.
    expect(scoreOf({ wants: 4, dontWants: 1 }, 10)).toBe(scoreOf({ wants: 2, dontWants: 0 }, 10));
  });
});

describe("relative tiers by score", () => {
  it("splits ranked lines 20 / 25 / 30 / rest", () => {
    const { lines, votes } = ladder(20);
    const tiers = buildTiers(votes, 20, lines);
    // ceil(0.2*20)=4 S, ceil(0.45*20)=9 -> 5 A, ceil(0.75*20)=15 -> 6 B, 5 C.
    expect([tiers.get("S")!.length, tiers.get("A")!.length, tiers.get("B")!.length, tiers.get("C")!.length]).toEqual([4, 5, 6, 5]);
    // One point per Want: 20, 19, 18, 17 wants.
    expect(tiers.get("S")!.map((r) => r.score)).toEqual([20, 19, 18, 17]);
  });

  it("avoids negative support, while zero support remains ranked", () => {
    const [a, b, c] = [...LINES_BY_ID.values()];
    const votes = new Map([[a.id, { wants: 3, dontWants: 3 }], [b.id, { wants: 1, dontWants: 0 }], [c.id, { wants: 0, dontWants: 0 }]]);
    const tiers = buildTiers(votes, 6, [a, b, c]);
    expect(ids(tiers, "S")).toEqual([b.id]);
    expect(ids(tiers, "C")).toEqual([c.id]);
    expect(ids(tiers, "avoid")).toEqual([a.id]);
    expect(tiers.get("avoid")![0]).toMatchObject({ score: -3, support: -50, wantShare: 0.5, dontShare: 0.5 });
  });

  it("keeps ties in the same tier", () => {
    const { lines, votes } = ladder(20);
    // Make the 5th-best line tie the 4th: it joins S instead of leading A.
    votes.set(lines[15].id, { wants: 17, dontWants: 0 });
    const tiers = buildTiers(votes, 20, lines);
    expect(tiers.get("S")!.map((r) => r.score)).toEqual([20, 19, 18, 17, 17]);
  });

  it("places a big tie by its middle rank so it can't swallow S", () => {
    const { lines, votes } = ladder(20);
    // Lines ranked 2nd to 11th all tie on 10 wants: middle rank 6 -> A.
    for (const line of lines.slice(9, 19)) votes.set(line.id, { wants: 10, dontWants: 0 });
    const tiers = buildTiers(votes, 20, lines);
    expect(tiers.get("S")!.map((r) => r.score)).toEqual([20]);
    expect(tiers.get("A")!.length).toBe(10);
    expect(new Set(tiers.get("A")!.map((r) => r.score))).toEqual(new Set([10]));
  });

  it("puts a single friend's wants (all tied) in S", () => {
    const lines = [...LINES_BY_ID.values()].slice(0, 30);
    const votes = countVotes([{ wants: lines.slice(0, 20).map((l) => l.id), dont_wants: [] }]);
    const tiers = buildTiers(votes, 1, lines);
    expect(tiers.get("S")!.length).toBe(20);
    expect(tiers.get("C")!.length).toBe(10);
  });

  it("does not let Neutral votes rescue negative support from Avoid", () => {
    const [a, b, c, d] = [...LINES_BY_ID.values()];
    const votes = new Map([[a.id, { wants: 1, dontWants: 4 }], [b.id, { wants: 0, dontWants: 1 }], [c.id, { wants: 0, dontWants: 0 }], [d.id, { wants: 2, dontWants: 1 }]]);
    const tiers = buildTiers(votes, 5, [a, b, c, d]);
    expect(ids(tiers, "avoid")).toEqual([b.id, a.id]);
    expect(ids(tiers, "C")).toEqual([c.id, d.id]);
    expect(tiers.get("C")!.map((r) => r.support)).toEqual([0, 0]);
  });

  it("doesn't let stars change the score", () => {
    const [a, b] = [...LINES_BY_ID.values()];
    const votes = new Map([
      [a.id, { wants: 1, dontWants: 1, tops: 1 }], // starred, but 1 - 2 = -1
      [b.id, { wants: 1, dontWants: 0, tops: 0 }], // 1 Want = +1
    ]);
    const tiers = buildTiers(votes, 2, [a, b]);
    expect(ids(tiers, "S")).toEqual([b.id]);
    expect(ids(tiers, "avoid")).toEqual([a.id]);
  });

  it("breaks score ties by Top 3 stars before anything else", () => {
    // mewtwo is legendary and eevee has the most don't-wants, but eevee's star puts it first among the lines tied on score 2.
    const [mewtwo, eevee] = ["mewtwo", "eevee"].map((id) => LINES_BY_ID.get(id)!);
    const votes = new Map([
      [mewtwo.id, { wants: 2, dontWants: 0, tops: 0 }], // 2 Wants = +2
      [eevee.id, { wants: 4, dontWants: 1, tops: 1 }], // 4 Wants - 2 = +2
    ]);
    const tiers = buildTiers(votes, 5, [mewtwo, eevee]);
    expect(ids(tiers, "S")).toEqual([eevee.id, mewtwo.id]);
    expect(tiers.get("S")!.map((r) => r.score)).toEqual([2, 2]);
  });

  it("puts everything in C with no voters", () => {
    const tiers = buildTiers(new Map(), 0);
    expect(tiers.get("C")!.length).toBe([...LINES_BY_ID.keys()].length);
    expect(tiers.get("C")![0].wantShare).toBeNull();
  });
});

describe("buildTiers", () => {
  it("keeps every starred line in the Top 3 row (the board folds past TOP_ROW_SIZE)", () => {
    const lineIds = [...LINES_BY_ID.keys()].slice(0, TOP_ROW_SIZE + 3);
    const votes = countVotes(lineIds.map((id) => ({ wants: [id], dont_wants: [], top_wants: [id] })));
    const lines = lineIds.map((id) => LINES_BY_ID.get(id)!);
    expect(buildTiers(votes, lineIds.length, lines).get("top")).toHaveLength(TOP_ROW_SIZE + 3);
  });

  it("repeats the most-starred lines in a Top 3 row without moving them out of their tier", () => {
    const lineIds = ["bulbasaur", "charmander", "squirtle", "pikachu", "eevee"];
    const lines = lineIds.map((id) => LINES_BY_ID.get(id)!);
    const votes = countVotes([
      { wants: lineIds, dont_wants: [], top_wants: ["pikachu", "eevee", "squirtle"] },
      { wants: lineIds, dont_wants: [], top_wants: ["pikachu", "eevee", "charmander"] },
      { wants: [], dont_wants: ["bulbasaur"], top_wants: [] },
    ]);
    const tiers = buildTiers(votes, 3, lines);
    // pikachu and eevee have 2 stars; charmander and squirtle tie on 1 and every
    // other key, so dex order breaks the tie. bulbasaur has no stars.
    expect(ids(tiers, "top")).toEqual(["pikachu", "eevee", "charmander", "squirtle"]);
    // Stars don't score: the four starred lines all score 2 and share S, ordered
    // by stars; bulbasaur (2 - 2 = 0) falls to C.
    expect(ids(tiers, "S")).toEqual(["pikachu", "eevee", "charmander", "squirtle"]);
    expect(ids(tiers, "C")).toEqual(["bulbasaur"]);
    expect(tiers.get("S")![0].score).toBe(2);
    const placed = [...tiers.entries()].filter(([id]) => id !== "top").flatMap(([, r]) => r).map((r) => r.line.id);
    expect(placed.sort()).toEqual([...lineIds].sort());
    expect(tiers.get("top")![0].tops).toBe(2);
  });

  it("breaks score ties by rarity (all rare kinds equal), then fewer don't-wants, then dex", () => {
    const lines = ["pikachu", "ditto", "larvitar", "mewtwo", "eevee"].map((id) => LINES_BY_ID.get(id)!);
    const votes = countVotes([
      { wants: ["pikachu", "ditto", "larvitar", "mewtwo", "eevee"], dont_wants: [] },
      { wants: ["pikachu"], dont_wants: [] },
      { wants: ["pikachu"], dont_wants: [] },
      { wants: [], dont_wants: ["pikachu"] },
    ]);
    // All score 1 (one Want; Pikachu 3 Wants - 2). Ditto (16-pip), mewtwo
    // (legendary) and larvitar (pseudo) come first in dex order, not by kind;
    // then eevee, then pikachu with its don't-want.
    expect(ids(buildTiers(votes, 4, lines), "S")).toEqual(["ditto", "mewtwo", "larvitar", "eevee", "pikachu"]);
  });

  it("counts votes per line, ignoring duplicate ids", () => {
    const votes = countVotes([
      { wants: ["pikachu", "squirtle", "charmander"], dont_wants: [] },
      { wants: ["pikachu", "squirtle", "squirtle"], dont_wants: ["charmander"] },
      { wants: ["pikachu"], dont_wants: ["charmander"] },
    ]);
    expect(votes.get("squirtle")).toEqual({ wants: 2, dontWants: 0, tops: 0 });
    expect(votes.get("charmander")).toEqual({ wants: 1, dontWants: 2, tops: 0 });
    const lines = ["bulbasaur", "charmander", "squirtle", "pikachu"].map((id) => LINES_BY_ID.get(id)!);
    const tiers = buildTiers(votes, 3, lines);
    // pikachu (3) S, squirtle (2) B; nobody voted on bulbasaur (0) so it
    // lands in C; charmander (1 - 4) is Avoid.
    expect(ids(tiers, "S")).toEqual(["pikachu"]);
    expect(ids(tiers, "B")).toEqual(["squirtle"]);
    expect(ids(tiers, "C")).toEqual(["bulbasaur"]);
    expect(tiers.get("S")![0]).toMatchObject({ wants: 3, neutral: 0, dontWants: 0, wantShare: 1, dontShare: 0 });
    expect(ids(tiers, "avoid")).toEqual(["charmander"]);
  });

  it("ranks 39 want + 11 don't tiers below 39 want + 11 neutral", () => {
    // 50 voters. pikachu: 39 Want, 11 Neutral (+39). eevee: 39 Want, 11 Don't Want (+17).
    // Seven candies in between: 35..29 Wants, the rest Neutral.
    const [pikachu, eevee] = ["pikachu", "eevee"].map((id) => LINES_BY_ID.get(id)!);
    const fillers = [...LINES_BY_ID.values()].filter((l) => l !== pikachu && l !== eevee).slice(0, 7);
    const votes = new Map<string, { wants: number; dontWants: number }>([
      [pikachu.id, { wants: 39, dontWants: 0 }],
      [eevee.id, { wants: 39, dontWants: 11 }],
      ...fillers.map((l, i) => [l.id, { wants: 35 - i, dontWants: 0 }] as [string, { wants: number; dontWants: number }]),
    ]);
    const tiers = buildTiers(votes, 50, [pikachu, eevee, ...fillers]);
    // 9 ranked lines: S = 2, A = 3, B = 2, C = 2. eevee ranks last.
    expect(ids(tiers, "S")[0]).toBe(pikachu.id);
    expect(ids(tiers, "C").at(-1)).toBe(eevee.id);
    expect(tiers.get("C")!.at(-1)).toMatchObject({ score: 17, neutral: 0, dontShare: 0.22 });
  });

  it("keeps Avoid lines in the Top 3 row, so nobody's pick is left out", () => {
    const [a, b] = [...LINES_BY_ID.values()];
    const votes = new Map([
      [a.id, { wants: 5, dontWants: 11, tops: 5 }], // 5 - 22 = -17
      [b.id, { wants: 1, dontWants: 0, tops: 1 }],
    ]);
    const tiers = buildTiers(votes, 16, [a, b]);
    expect(ids(tiers, "avoid")).toEqual([a.id]);
    expect(ids(tiers, "top")).toEqual([a.id, b.id]);
  });
});

describe("net support", () => {
  it("centers Neutral on 0 and preserves the asymmetric opposition weight", () => {
    expect(supportOf(-100, 50)).toBe(-200);
    expect(supportOf(0, 50)).toBe(0);
    expect(supportOf(50, 50)).toBe(100);
    expect(supportOf(17, 50)).toBe(34);
    expect(supportOf(3, 0)).toBeNull();
  });
  it("distinguishes the reported Bulbasaur and Chikorita examples", () => {
    const bulbasaur = supportOf(scoreOf({ wants: 112, dontWants: 27 }, 201), 201)!;
    const chikorita = supportOf(scoreOf({ wants: 95, dontWants: 18 }, 201), 201)!;
    expect(formatSupport(bulbasaur)).toBe("+28.9");
    expect(formatSupport(chikorita)).toBe("+29.4");
    expect(chikorita).toBeGreaterThan(bulbasaur);
  });
  it("anchors an entirely Neutral list in C in both ranked styles", () => {
    const lines = [...LINES_BY_ID.values()].slice(0, 10);
    for (const style of ["standard", "fixed"] as const) {
      const tiers = buildTiers(new Map(), 50, lines, style);
      expect(tiers.get("C")).toHaveLength(10);
      expect(tiers.get("S")).toHaveLength(0);
      expect(tiers.get("C")!.every((row) => row.support === 0)).toBe(true);
    }
  });
  it("retains the sign of tiny scores instead of rounding a negative to zero", () => {
    expect(formatSupport(0)).toBe("0");
    expect(formatSupport(-0.001)).toBe("−<0.1");
    expect(formatSupport(0.001)).toBe("+<0.1");
    expect(formatSupport(-200)).toBe("−200");
    expect(formatSupport(100)).toBe("+100");
  });
  it("never places negative support outside Avoid in Standard or Fixed Scores", () => {
    const lines = [...LINES_BY_ID.values()].slice(0, 20);
    const votes = new Map(lines.map((line, i) => [line.id, { wants: i, dontWants: 9 - Math.floor(i / 2) }]));
    for (const style of ["standard", "fixed"] as const) for (const [tier, rows] of buildTiers(votes, 30, lines, style)) {
      if (tier !== "top") for (const row of rows) expect(row.support! < 0).toBe(tier === "avoid");
    }
  });
});
