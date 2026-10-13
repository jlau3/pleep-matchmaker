import { describe, expect, it } from "vitest";
import { LINES_BY_ID } from "./lines";
import { buildTiers, countVotes, ratingOf, TOP_ROW_SIZE } from "./tiers";

/** n lines where line i has i+1 wants from n voters, so every score is distinct. */
function ladder(n: number) {
  const lines = [...LINES_BY_ID.values()].slice(0, n);
  const votes = new Map(lines.map((line, i) => [line.id, { wants: i + 1, dontWants: 0 }]));
  return { lines, votes };
}

const ids = (tiers: Map<string, { line: { id: string } }[]>, tier: string) => tiers.get(tier)!.map((r) => r.line.id);

describe("relative tiers by net score", () => {
  it("splits wanted lines 15 / 20 / 30 / rest", () => {
    const { lines, votes } = ladder(20);
    const tiers = buildTiers(votes, 20, lines);
    // ceil(0.15*20)=3 S, ceil(0.35*20)=7 -> 4 A, ceil(0.65*20)=13 -> 6 B, 7 C.
    expect([tiers.get("S")!.length, tiers.get("A")!.length, tiers.get("B")!.length, tiers.get("C")!.length]).toEqual([3, 4, 6, 7]);
    expect(tiers.get("S")!.map((r) => r.score)).toEqual([20, 19, 18]);
  });

  it("subtracts don't-wants: a split room scores 0 and lands in C", () => {
    const [a, b, c] = [...LINES_BY_ID.values()];
    const votes = new Map([
      [a.id, { wants: 3, dontWants: 3 }],
      [b.id, { wants: 1, dontWants: 0 }],
      [c.id, { wants: 0, dontWants: 0 }],
    ]);
    const tiers = buildTiers(votes, 6, [a, b, c]);
    expect(ids(tiers, "S")).toEqual([b.id]);
    // Both score 0; c sorts first on fewer don't-wants.
    expect(ids(tiers, "C")).toEqual([c.id, a.id]);
    expect(tiers.get("C")![1]).toMatchObject({ score: 0, wantShare: 0.5, dontShare: 0.5 });
  });

  it("keeps ties in the same tier", () => {
    const { lines, votes } = ladder(20);
    // Make the 4th-best line tie the 3rd: it joins S instead of leading A.
    votes.set(lines[16].id, { wants: 18, dontWants: 0 });
    const tiers = buildTiers(votes, 20, lines);
    expect(tiers.get("S")!.map((r) => r.score)).toEqual([20, 19, 18, 18]);
  });

  it("places a big tie by its middle rank so it can't swallow S", () => {
    const { lines, votes } = ladder(20);
    // Lines ranked 2nd to 11th all tie on score 10: middle rank 6 -> A.
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

  it("puts lines with more don't-wants than wants in Avoid", () => {
    const [a, b, c, d] = [...LINES_BY_ID.values()];
    const votes = new Map([
      [a.id, { wants: 1, dontWants: 4 }], // wanted by someone, but outvoted
      [b.id, { wants: 0, dontWants: 1 }],
      [c.id, { wants: 0, dontWants: 0 }],
      [d.id, { wants: 2, dontWants: 1 }],
    ]);
    const tiers = buildTiers(votes, 5, [a, b, c, d]);
    expect(ids(tiers, "S")).toEqual([d.id]);
    expect(ids(tiers, "avoid")).toEqual([b.id, a.id]);
    expect(ids(tiers, "C")).toEqual([c.id]);
  });

  it("doesn't let stars change the score", () => {
    const [a, b] = [...LINES_BY_ID.values()];
    const votes = new Map([
      [a.id, { wants: 1, dontWants: 1, tops: 1 }], // starred, but 1 - 1 = 0: C
      [b.id, { wants: 1, dontWants: 0, tops: 0 }],
    ]);
    const tiers = buildTiers(votes, 2, [a, b]);
    expect(ids(tiers, "S")).toEqual([b.id]);
    expect(ids(tiers, "C")).toEqual([a.id]);
  });

  it("breaks score ties by Top 3 stars before anything else", () => {
    // mewtwo has the biggest rarity weight and eevee the most don't-wants, but
    // eevee's star puts it first among the lines tied on score 2.
    const [mewtwo, eevee] = ["mewtwo", "eevee"].map((id) => LINES_BY_ID.get(id)!);
    const votes = new Map([
      [mewtwo.id, { wants: 2, dontWants: 0, tops: 0 }],
      [eevee.id, { wants: 3, dontWants: 1, tops: 1 }],
    ]);
    const tiers = buildTiers(votes, 4, [mewtwo, eevee]);
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
    // by stars; bulbasaur (2 - 1) falls to C.
    expect(ids(tiers, "S")).toEqual(["pikachu", "eevee", "charmander", "squirtle"]);
    expect(ids(tiers, "C")).toEqual(["bulbasaur"]);
    expect(tiers.get("S")![0].score).toBe(2);
    const placed = [...tiers.entries()].filter(([id]) => id !== "top").flatMap(([, r]) => r).map((r) => r.line.id);
    expect(placed.sort()).toEqual([...lineIds].sort());
    expect(tiers.get("top")![0].tops).toBe(2);
  });

  it("breaks score ties by rarity weight, then fewer don't-wants", () => {
    const lines = ["pikachu", "ditto", "larvitar", "mewtwo", "eevee"].map((id) => LINES_BY_ID.get(id)!);
    const votes = countVotes([
      { wants: ["pikachu", "ditto", "larvitar", "mewtwo", "eevee"], dont_wants: [] },
      { wants: ["pikachu"], dont_wants: [] },
      { wants: [], dont_wants: ["pikachu"] },
    ]);
    // All score 1 (pikachu 2 - 1); eevee and pikachu have no rarity weight, and pikachu has a don't-want.
    expect(ids(buildTiers(votes, 2, lines), "S")).toEqual(["mewtwo", "larvitar", "ditto", "eevee", "pikachu"]);
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
    // pikachu (3) S, squirtle (2) B; charmander (1 - 2) is Avoid; nobody voted on bulbasaur: C.
    expect(ids(tiers, "S")).toEqual(["pikachu"]);
    expect(ids(tiers, "B")).toEqual(["squirtle"]);
    expect(tiers.get("S")![0]).toMatchObject({ wants: 3, neutral: 0, dontWants: 0, wantShare: 1, dontShare: 0 });
    expect(ids(tiers, "avoid")).toEqual(["charmander"]);
    expect(ids(tiers, "C")).toEqual(["bulbasaur"]);
  });

  it("ranks 39 want + 11 don't tiers below 39 want + 11 neutral", () => {
    // 50 voters. pikachu: 39 want, 11 neutral (39). eevee: 39 want, 11 don't (28).
    // Seven lines in between score 35..29 (wants only).
    const [pikachu, eevee] = ["pikachu", "eevee"].map((id) => LINES_BY_ID.get(id)!);
    const fillers = [...LINES_BY_ID.values()].filter((l) => l !== pikachu && l !== eevee).slice(0, 7);
    const votes = new Map<string, { wants: number; dontWants: number }>([
      [pikachu.id, { wants: 39, dontWants: 0 }],
      [eevee.id, { wants: 39, dontWants: 11 }],
      ...fillers.map((l, i) => [l.id, { wants: 35 - i, dontWants: 0 }] as [string, { wants: number; dontWants: number }]),
    ]);
    const tiers = buildTiers(votes, 50, [pikachu, eevee, ...fillers]);
    // 9 lines above 0: S = 2, A = 2, B = 2, C = 3. eevee ranks last.
    expect(ids(tiers, "S")[0]).toBe(pikachu.id);
    expect(ids(tiers, "C").at(-1)).toBe(eevee.id);
    expect(tiers.get("C")!.at(-1)).toMatchObject({ score: 28, neutral: 0, dontShare: 0.22 });
  });

  it("keeps Avoid lines in the Top 3 row, so nobody's pick is left out", () => {
    const [a, b] = [...LINES_BY_ID.values()];
    const votes = new Map([
      [a.id, { wants: 5, dontWants: 11, tops: 5 }], // 10 - 11 = -1
      [b.id, { wants: 1, dontWants: 0, tops: 1 }],
    ]);
    const tiers = buildTiers(votes, 16, [a, b]);
    expect(ids(tiers, "avoid")).toEqual([a.id]);
    expect(ids(tiers, "top")).toEqual([a.id, b.id]);
  });
});

describe("ratingOf", () => {
  it("maps the net score onto 0-100 for the pool", () => {
    expect(ratingOf(-50, 50)).toBe(0); // 50 don't-wants
    expect(ratingOf(0, 50)).toBe(50); // split room, or all neutral
    expect(ratingOf(50, 50)).toBe(100); // 50 wants
    expect(ratingOf(28, 50)).toBe(78); // 39 want + 11 don't
    expect(ratingOf(3, 0)).toBeNull();
  });

  it("is on every ranked line", () => {
    const [a] = [...LINES_BY_ID.values()];
    const tiers = buildTiers(new Map([[a.id, { wants: 3, dontWants: 1 }]]), 4, [a]);
    expect(tiers.get("S")![0].rating).toBe(75);
  });
});
