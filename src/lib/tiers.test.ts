import { describe, expect, it } from "vitest";
import { LINES_BY_ID } from "./lines";
import { buildTiers, countVotes, TOP_ROW_SIZE } from "./tiers";

/** n lines where line i has i+1 wants from n voters, so every demand is distinct. */
function ladder(n: number) {
  const lines = [...LINES_BY_ID.values()].slice(0, n);
  const votes = new Map(lines.map((line, i) => [line.id, { wants: i + 1, dontWants: 0 }]));
  return { lines, votes };
}

const ids = (tiers: Map<string, { line: { id: string } }[]>, tier: string) => tiers.get(tier)!.map((r) => r.line.id);

describe("relative tiers by demand", () => {
  it("splits wanted lines 15 / 20 / 30 / rest", () => {
    const { lines, votes } = ladder(20);
    const tiers = buildTiers(votes, 20, lines);
    // ceil(0.15*20)=3 S, ceil(0.35*20)=7 -> 4 A, ceil(0.65*20)=13 -> 6 B, 7 C.
    expect([tiers.get("S")!.length, tiers.get("A")!.length, tiers.get("B")!.length, tiers.get("C")!.length]).toEqual([3, 4, 6, 7]);
    expect(tiers.get("S")!.map((r) => r.demand)).toEqual([20, 19, 18]);
  });

  it("does not let don't-wants cancel wants", () => {
    const [a, b, c] = [...LINES_BY_ID.values()];
    const votes = new Map([
      [a.id, { wants: 3, dontWants: 3 }], // split room: still 3 people want it
      [b.id, { wants: 1, dontWants: 0 }],
      [c.id, { wants: 0, dontWants: 0 }],
    ]);
    const tiers = buildTiers(votes, 6, [a, b, c]);
    expect(ids(tiers, "S")).toEqual([a.id]);
    expect(tiers.get("S")![0]).toMatchObject({ demand: 3, wantShare: 0.5 });
  });

  it("keeps ties in the same tier", () => {
    const { lines, votes } = ladder(20);
    // Make the 4th-best line tie the 3rd: it joins S instead of leading A.
    votes.set(lines[16].id, { wants: 18, dontWants: 0 });
    const tiers = buildTiers(votes, 20, lines);
    expect(tiers.get("S")!.map((r) => r.demand)).toEqual([20, 19, 18, 18]);
  });

  it("places a big tie by its middle rank so it can't swallow S", () => {
    const { lines, votes } = ladder(20);
    // Lines ranked 2nd to 11th all tie on demand 10: middle rank 6 -> A.
    for (const line of lines.slice(9, 19)) votes.set(line.id, { wants: 10, dontWants: 0 });
    const tiers = buildTiers(votes, 20, lines);
    expect(tiers.get("S")!.map((r) => r.demand)).toEqual([20]);
    expect(tiers.get("A")!.length).toBe(10);
    expect(new Set(tiers.get("A")!.map((r) => r.demand))).toEqual(new Set([10]));
  });

  it("puts a single friend's wants (all tied) in S", () => {
    const lines = [...LINES_BY_ID.values()].slice(0, 30);
    const votes = countVotes([{ wants: lines.slice(0, 20).map((l) => l.id), dont_wants: [] }]);
    const tiers = buildTiers(votes, 1, lines);
    expect(tiers.get("S")!.length).toBe(20);
    expect(tiers.get("C")!.length).toBe(10);
  });

  it("puts no-demand lines in Avoid if anyone said don't want, else C", () => {
    const [a, b, c] = [...LINES_BY_ID.values()];
    const votes = new Map([
      [a.id, { wants: 1, dontWants: 4 }], // wanted by someone: ranked, not Avoid
      [b.id, { wants: 0, dontWants: 1 }],
      [c.id, { wants: 0, dontWants: 0 }],
    ]);
    const tiers = buildTiers(votes, 5, [a, b, c]);
    expect(ids(tiers, "S")).toEqual([a.id]);
    expect(ids(tiers, "avoid")).toEqual([b.id]);
    expect(ids(tiers, "C")).toEqual([c.id]);
  });

  it("counts a starred want double", () => {
    const [a, b] = [...LINES_BY_ID.values()];
    const votes = new Map([
      [a.id, { wants: 2, dontWants: 0, tops: 0 }],
      [b.id, { wants: 1, dontWants: 0, tops: 1 }],
    ]);
    // Both demand 2 -> tied, both S; the share shown is plain wants.
    const tiers = buildTiers(votes, 2, [a, b]);
    expect(tiers.get("S")!.map((r) => r.demand)).toEqual([2, 2]);
    expect(tiers.get("S")!.map((r) => r.wantShare)).toEqual([1, 0.5]);
  });

  it("puts everything in C with no voters", () => {
    const tiers = buildTiers(new Map(), 0);
    expect(tiers.get("C")!.length).toBe([...LINES_BY_ID.keys()].length);
    expect(tiers.get("C")![0].wantShare).toBeNull();
  });
});

describe("buildTiers", () => {
  it("caps the Top 3 row at TOP_ROW_SIZE lines", () => {
    const lineIds = [...LINES_BY_ID.keys()].slice(0, TOP_ROW_SIZE + 3);
    const votes = countVotes(lineIds.map((id) => ({ wants: [id], dont_wants: [], top_wants: [id] })));
    const lines = lineIds.map((id) => LINES_BY_ID.get(id)!);
    expect(buildTiers(votes, lineIds.length, lines).get("top")).toHaveLength(TOP_ROW_SIZE);
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
    // Demand: pikachu/eevee 2 + 2, charmander/squirtle 2 + 1, bulbasaur 2.
    // 5 wanted lines: S is the top run (pikachu, eevee), the one-star pair lands in B.
    expect(ids(tiers, "S")).toEqual(["pikachu", "eevee"]);
    expect(ids(tiers, "B")).toEqual(["charmander", "squirtle"]);
    expect(tiers.get("S")![0].demand).toBe(4);
    const placed = [...tiers.entries()].filter(([id]) => id !== "top").flatMap(([, r]) => r).map((r) => r.line.id);
    expect(placed.sort()).toEqual([...lineIds].sort());
    expect(tiers.get("top")![0].tops).toBe(2);
  });

  it("breaks demand ties by rarity weight, then fewer don't-wants", () => {
    const lines = ["pikachu", "ditto", "larvitar", "mewtwo", "eevee"].map((id) => LINES_BY_ID.get(id)!);
    const votes = countVotes([
      { wants: ["pikachu", "ditto", "larvitar", "mewtwo", "eevee"], dont_wants: [] },
      { wants: [], dont_wants: ["pikachu"] },
    ]);
    // All demand 1; eevee and pikachu have no rarity weight, and pikachu has a don't-want.
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
    // 3 wanted lines: pikachu (3) S, squirtle (2) A, charmander (1) falls past B into C,
    // above bulbasaur, which nobody voted on.
    expect(ids(tiers, "S")).toEqual(["pikachu"]);
    expect(ids(tiers, "A")).toEqual(["squirtle"]);
    expect(tiers.get("S")![0]).toMatchObject({ wants: 3, unsure: 0, dontWants: 0, wantShare: 1 });
    expect(ids(tiers, "C")).toEqual(["charmander", "bulbasaur"]);
  });

  it("ranks equal demand by fewer don't-wants (39 want + 11 unsure above 39 want + 11 don't)", () => {
    const [a, b] = ["pikachu", "eevee"].map((id) => LINES_BY_ID.get(id)!); // neither has rarity weight
    const votes = new Map([
      [b.id, { wants: 39, dontWants: 11 }],
      [a.id, { wants: 39, dontWants: 0 }],
    ]);
    const tiers = buildTiers(votes, 50, [b, a]);
    expect(ids(tiers, "S")).toEqual([a.id, b.id]);
    expect(tiers.get("S")!.map((r) => r.unsure)).toEqual([11, 0]);
  });
});
