import { describe, expect, it } from "vitest";
import { firstProfileGuideStep, profileGuideError, profileGuideSteps } from "./profileGuide";
import { AVATAR_NAMES } from "./avatars";

const avatar = `${AVATAR_NAMES[0]}:normal`;

describe("profile walkthrough", () => {
  it("starts at the first essential that still needs attention", () => {
    expect(firstProfileGuideStep({ ign: null, friend_code: null })).toBe(0);
    expect(firstProfileGuideStep({ ign: "Sleepy", friend_code: "123" })).toBe(1);
    expect(firstProfileGuideStep({ ign: "Sleepy", friend_code: "123456789012" })).toBe(2);
    expect(firstProfileGuideStep({ ign: "Sleepy", friend_code: "123456789012", game_avatar: avatar })).toBe(3);
  });

  it("offers social-name guidance only when there are names to share", () => {
    expect(profileGuideSteps(false).map((step) => step.id)).toEqual(["ign", "friend_code", "game_avatar", "visibility"]);
    expect(profileGuideSteps(true).at(-1)?.id).toBe("sharing");
  });

  it("requires real values before advancing past essential fields", () => {
    const form = new FormData();
    expect(profileGuideError("ign", form)).toBeTruthy();
    form.set("ign", "  ");
    expect(profileGuideError("ign", form)).toBeTruthy();
    form.set("ign", "Sleepy");
    expect(profileGuideError("ign", form)).toBeNull();
    form.set("friend_code", "1234");
    expect(profileGuideError("friend_code", form)).toBeTruthy();
    form.set("friend_code", "1234 5678 9012");
    expect(profileGuideError("friend_code", form)).toBeNull();
    form.set("game_avatar", "not-a-pokemon:normal");
    expect(profileGuideError("game_avatar", form)).toBeTruthy();
    form.set("game_avatar", avatar);
    expect(profileGuideError("game_avatar", form)).toBeNull();
  });

  it("doesn't force a player to change their existing privacy choices", () => {
    expect(profileGuideError("visibility", new FormData())).toBeNull();
    expect(profileGuideError("sharing", new FormData())).toBeNull();
  });
});
