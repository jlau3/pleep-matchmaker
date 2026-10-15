import { describe, expect, it } from "vitest";
import { nameMatch, strongNameKey } from "./names";

describe("strongNameKey", () => {
  it("ignores case, spaces, separators and decorations", () => {
    for (const name of ["Mr Time", "mr_time", "MR.TIME", "★Mr Time★", "Ｍｒ　Ｔｉｍｅ", "mr-time!"]) expect(strongNameKey(name)).toBe("mrtime");
  });
  it("keeps letters in any script", () => {
    expect(strongNameKey("ゆき・だるま")).toBe("ゆきだるま");
    expect(strongNameKey("ユーキ")).toBe("ユーキ"); // the long vowel mark is part of the name
  });
  it("keeps an all-symbol name as typed", () => {
    expect(strongNameKey("★★")).toBe("★★");
  });
});

describe("nameMatch", () => {
  it("strong for the same name written differently", () => {
    expect(nameMatch("Mr_Time", "mr time")).toBe("strong");
    expect(nameMatch("M", "m")).toBe("strong");
  });
  it("close for a contained name or one typo", () => {
    expect(nameMatch("Snorlax", "Snorlax Lover")).toBe("close");
    expect(nameMatch("Mr Tme", "Mr Time")).toBe("close");
    expect(nameMatch("Jackie", "Jacky")).toBeNull(); // two edits apart
  });
  it("nothing for short or unrelated names", () => {
    expect(nameMatch("M", "Mo")).toBeNull();
    expect(nameMatch("Mo", "Molli")).toBeNull();
    expect(nameMatch("mrl", "Mr Time")).toBeNull();
    expect(nameMatch("Anna", "Hanna")).toBe("close"); // contained, 4+ characters
    expect(nameMatch(null, "x")).toBeNull();
  });
});
