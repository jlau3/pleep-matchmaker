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
    [{ wants: 5, dontWants: 5 }, 10, "none"],
    [{ wants: 0, dontWants: 0 }, 10, "none"],
    [{ wants: 1, dontWants: 3 }, 10, "avoid"],
    [{ wants: 0, dontWants: 0 }, 0, "none"],
  ] as const)("%o of %i voters -> %s", (votes, voters, tier) => {
    expect(tierFor(votes, voters)).toBe(tier);
  });
});

describe("buildTiers", () => {
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
    expect(tiers.get("none")!.map((r) => r.line.id)).toEqual(["bulbasaur"]);
    expect(votes.get("squirtle")).toEqual({ wants: 2, dontWants: 0 });
  });
});
