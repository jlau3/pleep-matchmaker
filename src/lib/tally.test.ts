import { describe, expect, it } from "vitest";
import { tally } from "./tally";

describe("tally", () => {
  it("orders by count then dex, ignoring duplicates and unknown ids", () => {
    const { lines, counts } = tally([
      ["eevee", "pikachu", "pikachu", "nope"],
      ["pikachu", "bulbasaur"],
      ["eevee", "pikachu"],
    ]);
    expect(lines.map((l) => l.id)).toEqual(["pikachu", "eevee", "bulbasaur"]);
    expect(counts.get("pikachu")).toBe(3);
    expect(counts.has("nope")).toBe(false);
  });
});
