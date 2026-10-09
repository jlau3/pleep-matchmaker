import { describe, expect, it } from "vitest";
import { groupByIsland, LINES, LINES_BY_ID, linesFromIds } from "./lines";

describe("candy line data", () => {
  it("has unique ids and at least one member per line", () => {
    expect(new Set(LINES.map((l) => l.id)).size).toBe(LINES.length);
    for (const line of LINES) expect(line.members.length).toBeGreaterThan(0);
  });
  it("folds forms into their base line", () => {
    const pikachu = LINES_BY_ID.get("pikachu")!.members.map((m) => m.name);
    expect(pikachu).toEqual(["Pichu", "Pikachu", "Raichu"]);
    expect(LINES_BY_ID.has("toxtricity")).toBe(false);
    expect(LINES_BY_ID.get("wooper")!.members.map((m) => m.name)).toContain("Clodsire");
  });
});

describe("linesFromIds", () => {
  it("sorts by dex and drops unknown ids", () => {
    expect(linesFromIds(["eevee", "nope", "bulbasaur"]).map((l) => l.id)).toEqual(["bulbasaur", "eevee"]);
  });
});

describe("groupByIsland", () => {
  const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
  it("returns one group when no island data exists", () => {
    expect(groupByIsland(items, [{ id: "x", name: "X", lines: [] }])).toEqual([{ id: "all", name: "All islands", items }]);
  });
  it("splits by island, repeats shared lines, and collects unmapped", () => {
    const groups = groupByIsland(items, [
      { id: "x", name: "X", lines: ["a", "b"] },
      { id: "y", name: "Y", lines: ["b"] },
      { id: "z", name: "Z", lines: ["zz"] },
    ]);
    expect(groups.map((g) => [g.id, g.items.map((i) => i.id)])).toEqual([
      ["x", ["a", "b"]],
      ["y", ["b"]],
      ["unmapped", ["c"]],
    ]);
  });
  it("returns nothing for no items", () => {
    expect(groupByIsland([])).toEqual([]);
  });
});
