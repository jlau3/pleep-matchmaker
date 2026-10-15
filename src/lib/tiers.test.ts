import { describe, expect, it } from "vitest";
import { LINES_BY_ID } from "./lines";
import { buildTiers, countVotes, ratingOf, scoreOf, TOP_ROW_SIZE } from "./tiers";

/** n lines where line i has i+1 wants from n voters, so every score is distinct. */
function ladder(n: number) {
  const lines = [...LINES_BY_ID.values()].slice(0, n);
  const votes = new Map(lines.map((line, i) => [line.id, { wants: i + 1, dontWants: 0 }]));
  return { lines, votes };
}

const ids = (tiers: Map<string, { line: { id: string } }[]>, tier: string) => tiers.get(tier)!.map((r) => r.line.id);

describe("scoreOf", () => {
  it("counts Want +3, Neutral +1, Don't Want -3, with everyone else Neutral", () => {
    expect(scoreOf({ wants: 10, dontWants: 4 }, 20)).toBe(30 + 6 - 12);
    expect(scoreOf({ wants: 0, dontWants: 0 }, 20)).toBe(20); // all neutral, or nobody voted on it
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
    // 20 voters + 2 per want: 20, 19, 18, 17 wants.
    expect(tiers.get("S")!.map((r) => r.score)).toEqual([60, 58, 56, 54]);
  });

  it("ranks a split room (score 0) instead of avoiding it", () => {
    const [a, b, c] = [...LINES_BY_ID.values()];
    const votes = new Map([
      [a.id, { wants: 3, dontWants: 3 }], // 9 - 9 + 0 neutral = 0
      [b.id, { wants: 1, dontWants: 0 }], // 3 + 5 = 8
      [c.id, { wants: 0, dontWants: 0 }], // 6 neutral = 6
    ]);
    const tiers = buildTiers(votes, 6, [a, b, c]);
    expect(ids(tiers, "S")).toEqual([b.id]);
    expect(ids(tiers, "A")).toEqual([c.id]);
    expect(ids(tiers, "B")).toEqual([a.id]);
    expect(tiers.get("B")![0]).toMatchObject({ score: 0, wantShare: 0.5, dontShare: 0.5 });
  });

  it("keeps ties in the same tier", () => {
    const { lines, votes } = ladder(20);
    // Make the 5th-best line tie the 4th: it joins S instead of leading A.
    votes.set(lines[15].id, { wants: 17, dontWants: 0 });
    const tiers = buildTiers(votes, 20, lines);
    expect(tiers.get("S")!.map((r) => r.score)).toEqual([60, 58, 56, 54, 54]);
  });

  it("places a big tie by its middle rank so it can't swallow S", () => {
    const { lines, votes } = ladder(20);
    // Lines ranked 2nd to 11th all tie on 10 wants: middle rank 6 -> A.
    for (const line of lines.slice(9, 19)) votes.set(line.id, { wants: 10, dontWants: 0 });
    const tiers = buildTiers(votes, 20, lines);
    expect(tiers.get("S")!.map((r) => r.score)).toEqual([60]);
    expect(tiers.get("A")!.length).toBe(10);
    expect(new Set(tiers.get("A")!.map((r) => r.score))).toEqual(new Set([40]));
  });

  it("puts a single friend's wants (all tied) in S", () => {
    const lines = [...LINES_BY_ID.values()].slice(0, 30);
    const votes = countVotes([{ wants: lines.slice(0, 20).map((l) => l.id), dont_wants: [] }]);
    const tiers = buildTiers(votes, 1, lines);
    expect(tiers.get("S")!.length).toBe(20);
    expect(tiers.get("C")!.length).toBe(10);
  });

  it("avoids a line only when Don't Wants outweigh the Wants and Neutrals", () => {
    const [a, b, c, d] = [...LINES_BY_ID.values()];
    const votes = new Map([
      [a.id, { wants: 1, dontWants: 4 }], // 3 + 0 - 12 = -9: outvoted
      [b.id, { wants: 0, dontWants: 1 }], // 4 neutral - 3 = 1: one dislike in a room that doesn't mind
      [c.id, { wants: 0, dontWants: 0 }], // 5
      [d.id, { wants: 2, dontWants: 1 }], // 6 + 2 - 3 = 5
    ]);
    const tiers = buildTiers(votes, 5, [a, b, c, d]);
    expect(ids(tiers, "avoid")).toEqual([a.id]);
    // c and d tie on 5; c sorts first on fewer don't-wants.
    expect(ids(tiers, "S")).toEqual([c.id, d.id]);
    expect(ids(tiers, "B")).toEqual([b.id]);
  });

  it("doesn't let stars change the score", () => {
    const [a, b] = [...LINES_BY_ID.values()];
    const votes = new Map([
      [a.id, { wants: 1, dontWants: 1, tops: 1 }], // starred, but 3 - 3 = 0
      [b.id, { wants: 1, dontWants: 0, tops: 0 }], // 3 + 1 = 4
    ]);
    const tiers = buildTiers(votes, 2, [a, b]);
    expect(ids(tiers, "S")).toEqual([b.id]);
    expect(ids(tiers, "B")).toEqual([a.id]);
  });

  it("breaks score ties by Top 3 stars before anything else", () => {
    // mewtwo has the lower dex and eevee the most don't-wants, but eevee's star puts it first among the lines tied on score 9.
    const [mewtwo, eevee] = ["mewtwo", "eevee"].map((id) => LINES_BY_ID.get(id)!);
    const votes = new Map([
      [mewtwo.id, { wants: 2, dontWants: 0, tops: 0 }], // 6 + 3 = 9
      [eevee.id, { wants: 4, dontWants: 1, tops: 1 }], // 12 + 0 - 3 = 9
    ]);
    const tiers = buildTiers(votes, 5, [mewtwo, eevee]);
    expect(ids(tiers, "S")).toEqual([eevee.id, mewtwo.id]);
    expect(tiers.get("S")!.map((r) => r.score)).toEqual([9, 9]);
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
    // Stars don't score: the four starred lines all score 7 and share S, ordered
    // by stars; bulbasaur (6 - 3) falls to C.
    expect(ids(tiers, "S")).toEqual(["pikachu", "eevee", "charmander", "squirtle"]);
    expect(ids(tiers, "C")).toEqual(["bulbasaur"]);
    expect(tiers.get("S")![0].score).toBe(7);
    const placed = [...tiers.entries()].filter(([id]) => id !== "top").flatMap(([, r]) => r).map((r) => r.line.id);
    expect(placed.sort()).toEqual([...lineIds].sort());
    expect(tiers.get("top")![0].tops).toBe(2);
  });

  it("breaks score ties by fewer don't-wants, then dex, ignoring rarity", () => {
    const lines = ["pikachu", "ditto", "larvitar", "mewtwo", "eevee"].map((id) => LINES_BY_ID.get(id)!);
    const votes = countVotes([
      { wants: ["pikachu", "ditto", "larvitar", "mewtwo", "eevee"], dont_wants: [] },
      { wants: ["pikachu"], dont_wants: [] },
      { wants: ["pikachu"], dont_wants: [] },
      { wants: [], dont_wants: ["pikachu"] },
    ]);
    // All score 6 (one want + 3 neutral; pikachu 9 - 3). Legendary, pseudo-legendary
    // and 16-pip lines get no edge: dex order, with pikachu's don't-want last.
    expect(ids(buildTiers(votes, 4, lines), "S")).toEqual(["ditto", "eevee", "mewtwo", "larvitar", "pikachu"]);
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
    // pikachu (9) S, squirtle (7) A; nobody voted on bulbasaur (3 neutral) so it
    // lands mid-pack in B; charmander (3 - 6) is Avoid.
    expect(ids(tiers, "S")).toEqual(["pikachu"]);
    expect(ids(tiers, "A")).toEqual(["squirtle"]);
    expect(ids(tiers, "B")).toEqual(["bulbasaur"]);
    expect(tiers.get("S")![0]).toMatchObject({ wants: 3, neutral: 0, dontWants: 0, wantShare: 1, dontShare: 0 });
    expect(ids(tiers, "avoid")).toEqual(["charmander"]);
  });

  it("ranks 39 want + 11 don't tiers below 39 want + 11 neutral", () => {
    // 50 voters. pikachu: 39 want, 11 neutral (128). eevee: 39 want, 11 don't (84).
    // Seven lines in between: 35..29 wants, the rest neutral (120..108).
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
    expect(tiers.get("C")!.at(-1)).toMatchObject({ score: 84, neutral: 0, dontShare: 0.22 });
  });

  it("keeps Avoid lines in the Top 3 row, so nobody's pick is left out", () => {
    const [a, b] = [...LINES_BY_ID.values()];
    const votes = new Map([
      [a.id, { wants: 5, dontWants: 11, tops: 5 }], // 15 - 33 = -18
      [b.id, { wants: 1, dontWants: 0, tops: 1 }],
    ]);
    const tiers = buildTiers(votes, 16, [a, b]);
    expect(ids(tiers, "avoid")).toEqual([a.id]);
    expect(ids(tiers, "top")).toEqual([a.id, b.id]);
  });
});

describe("ratingOf", () => {
  it("maps the score onto 0-100 for the pool", () => {
    expect(ratingOf(-150, 50)).toBe(0); // 50 don't-wants
    expect(ratingOf(0, 50)).toBe(50); // the Avoid line
    expect(ratingOf(50, 50)).toBe(67); // all neutral
    expect(ratingOf(150, 50)).toBe(100); // 50 wants
    expect(ratingOf(84, 50)).toBe(78); // 39 want + 11 don't
    expect(ratingOf(3, 0)).toBeNull();
  });

  it("is on every ranked line", () => {
    const [a] = [...LINES_BY_ID.values()];
    const tiers = buildTiers(new Map([[a.id, { wants: 3, dontWants: 1 }]]), 4, [a]);
    expect(tiers.get("S")![0].rating).toBe(75);
  });
});
