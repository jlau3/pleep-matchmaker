import { describe, expect, it } from "vitest";
import { LINES_BY_ID } from "./lines";
import { buildTiers, countVotes, TOP_ROW_SIZE } from "./tiers";

/** n lines where line i has i+1 wants from n voters, so every net is distinct. */
function ladder(n: number) {
  const lines = [...LINES_BY_ID.values()].slice(0, n);
  const votes = new Map(lines.map((line, i) => [line.id, { wants: i + 1, dontWants: 0 }]));
  return { lines, votes };
}

const ids = (tiers: Map<string, { line: { id: string } }[]>, tier: string) => tiers.get(tier)!.map((r) => r.line.id);

describe("relative tiers", () => {
  it("splits liked lines 15 / 20 / 30 / rest", () => {
    const { lines, votes } = ladder(20);
    const tiers = buildTiers(votes, 20, lines);
    // ceil(0.15*20)=3 S, ceil(0.35*20)=7 -> 4 A, ceil(0.65*20)=13 -> 6 B, 7 C.
    expect([tiers.get("S")!.length, tiers.get("A")!.length, tiers.get("B")!.length, tiers.get("C")!.length]).toEqual([3, 4, 6, 7]);
    expect(tiers.get("S")!.map((r) => r.net)).toEqual([20, 19, 18]);
  });

  it("keeps ties in the same tier", () => {
    const { lines, votes } = ladder(20);
    // Make the 4th-best line tie the 3rd: it joins S instead of leading A.
    votes.set(lines[16].id, { wants: 18, dontWants: 0 });
    const tiers = buildTiers(votes, 20, lines);
    expect(tiers.get("S")!.map((r) => r.net)).toEqual([20, 19, 18, 18]);
  });

  it("places a big tie by its middle rank so it can't swallow S", () => {
    const { lines, votes } = ladder(20);
    // Lines ranked 2nd to 11th all tie on net 10: middle rank 6 -> A.
    for (const line of lines.slice(9, 19)) votes.set(line.id, { wants: 10, dontWants: 0 });
    const tiers = buildTiers(votes, 20, lines);
    expect(tiers.get("S")!.map((r) => r.net)).toEqual([20]);
    expect(tiers.get("A")!.length).toBe(10);
    expect(new Set(tiers.get("A")!.map((r) => r.net))).toEqual(new Set([10]));
  });

  it("puts a single friend's wants (all tied) in S", () => {
    const lines = [...LINES_BY_ID.values()].slice(0, 30);
    const votes = countVotes([{ wants: lines.slice(0, 20).map((l) => l.id), dont_wants: [] }]);
    const tiers = buildTiers(votes, 1, lines);
    expect(tiers.get("S")!.length).toBe(20);
    expect(tiers.get("C")!.length).toBe(10);
  });

  it("puts net 0 in C and net below 0 in Avoid, whatever the ranks", () => {
    const { lines, votes } = ladder(3);
    const extra = [...LINES_BY_ID.values()].slice(3, 6);
    votes.set(extra[0].id, { wants: 0, dontWants: 0 });
    votes.set(extra[1].id, { wants: 2, dontWants: 2 });
    votes.set(extra[2].id, { wants: 0, dontWants: 1 });
    const tiers = buildTiers(votes, 3, [...lines, ...extra]);
    expect(ids(tiers, "C")).toEqual(expect.arrayContaining([extra[0].id, extra[1].id]));
    expect(ids(tiers, "avoid")).toEqual([extra[2].id]);
  });

  it("counts a starred want double", () => {
    const [a, b] = [...LINES_BY_ID.values()];
    const votes = new Map([
      [a.id, { wants: 2, dontWants: 0, tops: 0 }],
      [b.id, { wants: 1, dontWants: 0, tops: 1 }],
    ]);
    const tiers = buildTiers(votes, 2, [a, b]);
    // Both net 2 -> tied, both S.
    expect(tiers.get("S")!.map((r) => r.net)).toEqual([2, 2]);
    // A starred want also outweighs a don't-want.
    const mixed = buildTiers(new Map([[a.id, { wants: 1, dontWants: 1, tops: 1 }]]), 2, [a]);
    expect(ids(mixed, "S")).toEqual([a.id]);
  });

  it("puts everything in C with no voters", () => {
    const tiers = buildTiers(new Map(), 0);
    expect(tiers.get("C")!.length).toBe([...LINES_BY_ID.keys()].length);
  });
});

describe("buildTiers", () => {
  it("caps the Top 3 row at TOP_ROW_SIZE lines", () => {
    const ids = [...LINES_BY_ID.keys()].slice(0, TOP_ROW_SIZE + 3);
    const votes = countVotes(ids.map((id) => ({ wants: [id], dont_wants: [], top_wants: [id] })));
    const lines = ids.map((id) => LINES_BY_ID.get(id)!);
    expect(buildTiers(votes, ids.length, lines).get("top")).toHaveLength(TOP_ROW_SIZE);
  });

  it("repeats the most-starred lines in a Top 3 row without moving them out of their tier", () => {
    const ids = ["bulbasaur", "charmander", "squirtle", "pikachu", "eevee"];
    const lines = ids.map((id) => LINES_BY_ID.get(id)!);
    const votes = countVotes([
      { wants: ids, dont_wants: [], top_wants: ["pikachu", "eevee", "squirtle"] },
      { wants: ids, dont_wants: [], top_wants: ["pikachu", "eevee", "charmander"] },
      { wants: [], dont_wants: ["bulbasaur"], top_wants: [] },
    ]);
    const tiers = buildTiers(votes, 3, lines);
    // pikachu and eevee have 2 stars; charmander and squirtle tie on 1 and every
    // other key, so dex order breaks the tie. bulbasaur has no stars.
    expect(tiers.get("top")!.map((r) => r.line.id)).toEqual(["pikachu", "eevee", "charmander", "squirtle"]);
    // Two-star lines (net 2 + 2) outrank one-star lines (2 + 1): 5 liked lines,
    // so S is the top 1 (pikachu, with eevee tied), and the one-star pair lands in B.
    expect(tiers.get("S")!.map((r) => r.line.id)).toEqual(["pikachu", "eevee"]);
    expect(tiers.get("B")!.map((r) => r.line.id)).toEqual(["charmander", "squirtle"]);
    expect(tiers.get("S")![0].net).toBe(4);
    const placed = [...tiers.entries()].filter(([id]) => id !== "top").flatMap(([, r]) => r).map((r) => r.line.id);
    expect(placed.sort()).toEqual([...ids].sort());
    expect(tiers.get("top")![0].tops).toBe(2);
  });

  it("breaks net ties by rarity weight before wants", () => {
    const lines = ["pikachu", "ditto", "larvitar", "mewtwo"].map((id) => LINES_BY_ID.get(id)!);
    const votes = countVotes([
      { wants: ["pikachu", "ditto", "larvitar", "mewtwo"], dont_wants: [] },
      { wants: ["pikachu"], dont_wants: [] },
      { wants: [], dont_wants: ["pikachu"] },
    ]);
    // All net 1; Pikachu has the most wants but no rarity weight.
    expect(buildTiers(votes, 3, lines).get("S")!.map((r) => r.line.id)).toEqual(["mewtwo", "larvitar", "ditto", "pikachu"]);
  });

  it("buckets and orders lines", () => {
    const lines = ["bulbasaur", "charmander", "squirtle", "pikachu"].map((id) => LINES_BY_ID.get(id)!);
    const votes = countVotes([
      { wants: ["pikachu", "squirtle", "charmander"], dont_wants: [] },
      { wants: ["pikachu", "squirtle", "squirtle"], dont_wants: ["charmander"] },
      { wants: ["pikachu"], dont_wants: ["charmander"] },
    ]);
    const tiers = buildTiers(votes, 3, lines);
    // 2 liked lines: pikachu (net 3) is S, squirtle (net 2) falls to B.
    expect(tiers.get("S")!.map((r) => r.line.id)).toEqual(["pikachu"]);
    expect(tiers.get("B")!.map((r) => r.line.id)).toEqual(["squirtle"]);
    expect(tiers.get("avoid")!.map((r) => r.line.id)).toEqual(["charmander"]);
    expect(tiers.get("C")!.map((r) => r.line.id)).toEqual(["bulbasaur"]);
    expect(votes.get("squirtle")).toEqual({ wants: 2, dontWants: 0, tops: 0 });
    const charmander = tiers.get("avoid")![0];
    expect([charmander.wants, charmander.unsure, charmander.dontWants]).toEqual([1, 0, 2]);
    expect(tiers.get("B")![0]).toMatchObject({ wants: 2, unsure: 1, dontWants: 0 });
    // Display agreement ignores star weighting: (1 - 2) / 3.
    expect(charmander.agreement).toBeCloseTo(-1 / 3);
    expect(buildTiers(votes, 0, lines).get("C")![0].agreement).toBeNull();
  });
});
