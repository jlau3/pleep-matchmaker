import { describe, expect, it } from "vitest";
import { LINES_BY_ID } from "./lines";
import { buildTiers, countVotes, tierFor } from "./tiers";

describe("tierFor", () => {
  it.each([
    [{ wants: 6, dontWants: 0 }, 10, "S"],
    [{ wants: 7, dontWants: 1 }, 10, "S"],
    [{ wants: 5, dontWants: 1 }, 10, "A"],
    [{ wants: 2, dontWants: 0 }, 10, "B"],
    [{ wants: 1, dontWants: 0 }, 10, "C"],
    [{ wants: 5, dontWants: 5 }, 10, "C"],
    [{ wants: 0, dontWants: 0 }, 10, "C"],
    [{ wants: 1, dontWants: 3 }, 10, "avoid"],
    [{ wants: 0, dontWants: 0 }, 0, "C"],
  ] as const)("%o of %i voters -> %s", (votes, voters, tier) => {
    expect(tierFor(votes, voters)).toBe(tier);
  });
});

describe("buildTiers", () => {
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
    // other key, so dex order keeps charmander.
    expect(tiers.get("top")!.map((r) => r.line.id)).toEqual(["pikachu", "eevee", "charmander"]);
    expect(tiers.get("S")!.map((r) => r.line.id)).toEqual(["charmander", "squirtle", "pikachu", "eevee"]);
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
    expect(buildTiers(votes, 3, lines).get("B")!.map((r) => r.line.id)).toEqual(["mewtwo", "larvitar", "ditto", "pikachu"]);
  });

  it("buckets and orders lines", () => {
    const lines = ["bulbasaur", "charmander", "squirtle", "pikachu"].map((id) => LINES_BY_ID.get(id)!);
    const votes = countVotes([
      { wants: ["pikachu", "squirtle", "charmander"], dont_wants: [] },
      { wants: ["pikachu", "squirtle", "squirtle"], dont_wants: ["charmander"] },
      { wants: ["pikachu"], dont_wants: ["charmander"] },
    ]);
    const tiers = buildTiers(votes, 3, lines);
    expect(tiers.get("S")!.map((r) => r.line.id)).toEqual(["pikachu", "squirtle"]);
    expect(tiers.get("avoid")!.map((r) => r.line.id)).toEqual(["charmander"]);
    expect(tiers.get("C")!.map((r) => r.line.id)).toEqual(["bulbasaur"]);
    expect(votes.get("squirtle")).toEqual({ wants: 2, dontWants: 0, tops: 0 });
    const charmander = tiers.get("avoid")![0];
    expect([charmander.wants, charmander.unsure, charmander.dontWants]).toEqual([1, 0, 2]);
    expect(tiers.get("S")![1]).toMatchObject({ wants: 2, unsure: 1, dontWants: 0 });
  });
});
