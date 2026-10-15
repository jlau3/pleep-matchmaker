import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import lines from "@/data/candy-lines.json";
import { AVATAR_NAMES, AVATARS, avatarSrc, gameAvatarUrl, parseAvatar } from "./avatars";

describe("in-game icons", () => {
  it("has a file for every listed variant", () => {
    expect(AVATAR_NAMES.length).toBeGreaterThan(200);
    for (const name of AVATAR_NAMES)
      for (const variant of AVATARS[name]) expect(existsSync(path.join("public", avatarSrc(name, variant))), `${name}:${variant}`).toBe(true);
  });
  it("parses only known icons and variants", () => {
    expect(parseAvatar("pikachu:happy_shiny")).toEqual(["pikachu", "happy_shiny"]);
    expect(gameAvatarUrl("pikachu:shiny")).toBe("/avatars/portrait/pikachu_shiny.webp");
    expect(parseAvatar("pikachu:sleepy")).toBeNull();
    expect(parseAvatar("notamon:normal")).toBeNull();
    expect(parseAvatar("mew:shiny")).toBeNull(); // no shiny art for Mew
    expect(gameAvatarUrl(null)).toBeNull();
  });
  it("lists icons in Pokédex order, forms after the base Pokémon", () => {
    const compact = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const dex = new Map<string, number>();
    for (const line of lines) for (const m of line.members) if (!dex.has(compact(m.name))) dex.set(compact(m.name), m.dex);
    const order = AVATAR_NAMES.map((name) => {
      const n = dex.get(compact(name)) ?? dex.get(compact(name.split("_")[0]));
      expect(n, name).toBeDefined();
      return n!;
    });
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(AVATAR_NAMES.indexOf("pikachu")).toBeLessThan(AVATAR_NAMES.indexOf("pikachu_captain"));
  });
});
