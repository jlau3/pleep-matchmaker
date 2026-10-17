import { describe, expect, it } from "vitest";
import { snorlaxVariant } from "./snorlax";

describe("Snorlax surprise", () => {
  it("uses exactly one of 500 equal roll intervals for shiny", () => {
    expect(Array.from({ length: 500 }, (_, i) => snorlaxVariant(() => (i + 0.5) / 500)).filter((value) => value === "shiny")).toHaveLength(1);
    expect(snorlaxVariant(() => 0)).toBe("shiny");
    expect(snorlaxVariant(() => 1 / 500)).toBe("normal");
  });
});
