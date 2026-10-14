import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
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
});
