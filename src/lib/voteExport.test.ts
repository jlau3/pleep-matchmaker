import { describe, expect, it } from "vitest";
import { LINES_BY_ID, lineSpriteUrl } from "./lines";
import { voteExport } from "./voteExport";

const bulbasaur = LINES_BY_ID.get("bulbasaur")!;
const charmander = LINES_BY_ID.get("charmander")!;
const squirtle = LINES_BY_ID.get("squirtle")!;

describe("filtered vote exports", () => {
  it("keeps an excluded Spotlight candy while exporting only filtered votes and counts", () => {
    const { rows, counts } = voteExport({ bulbasaur: "want", charmander: "dont_want" }, new Set([bulbasaur.id]), [charmander, squirtle]);
    expect(rows[0].items).toEqual([{ sprite: lineSpriteUrl(bulbasaur) }]);
    expect(rows[1].items).toEqual([]);
    expect(rows[2].items).toEqual([{ sprite: lineSpriteUrl(squirtle) }]);
    expect(rows[3].items).toEqual([{ sprite: lineSpriteUrl(charmander) }]);
    expect(counts).toEqual({ want: 0, undecided: 1, dont_want: 1 });
  });
  it("preserves Spotlight when the filters match no votes", () => {
    const { rows, counts } = voteExport({ bulbasaur: "want" }, new Set([bulbasaur.id]), []);
    expect(rows[0].items).toHaveLength(1);
    expect(rows.slice(1).flatMap((row) => row.items)).toEqual([]);
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(0);
  });
});
