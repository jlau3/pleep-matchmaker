import { describe, expect, it } from "vitest";
import { spotlightOutsideF } from "./browse";

describe("Keep my Spotlight out of F", () => {
  it("accepts all known S–C tiers, including a partial Spotlight selection", () => {
    expect(spotlightOutsideF(["a"], { a: "C" })).toBe(true);
    expect(spotlightOutsideF(["a", "b", "c"], { a: "S", b: "B", c: "A" })).toBe(true);
  });
  it("rejects F, legacy Avoid, missing tiers, empty maps and no selected candy", () => {
    const cases: (Record<string, string> | undefined)[] = [undefined, {}, { a: "S" }, { a: "S", b: "Avoid" }, { a: "S", b: "F" }];
    for (const tiers of cases) {
      expect(spotlightOutsideF(["a", "b"], tiers)).toBe(false);
    }
    expect(spotlightOutsideF([], { a: "S" })).toBe(false);
  });
});
