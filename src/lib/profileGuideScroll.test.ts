import { describe, expect, it } from "vitest";
import { profileGuideScroll } from "./profileGuideScroll";

describe("profile guide scrolling", () => {
  const viewport = { top: 0, height: 800 };

  it("keeps the page still when the card fits below visible controls", () => {
    expect(profileGuideScroll({ top: 200, bottom: 350 }, 180, viewport, 0)).toBe(0);
  });

  it("places the card above controls instead of centering and scrolling them", () => {
    expect(profileGuideScroll({ top: 500, bottom: 740 }, 180, viewport, 200)).toBe(0);
  });

  it("only reveals the off-screen portion when there is room above the controls", () => {
    expect(profileGuideScroll({ top: 700, bottom: 900 }, 180, viewport, 0)).toBe(116);
  });

  it("chooses the smaller adjustment if neither placement currently fits", () => {
    expect(profileGuideScroll({ top: 150, bottom: 650 }, 160, viewport, 100)).toBe(46);
    expect(profileGuideScroll({ top: 160, bottom: 650 }, 140, viewport, 100)).toBe(-16);
  });

  it("does not attempt to scroll above the start of the document", () => {
    expect(profileGuideScroll({ top: 150, bottom: 650 }, 140, viewport, 0)).toBe(26);
  });

  it("accounts for the visual viewport when the mobile keyboard is open", () => {
    expect(profileGuideScroll({ top: 130, bottom: 250 }, 100, { top: 100, height: 400 }, 0)).toBe(0);
  });
});
