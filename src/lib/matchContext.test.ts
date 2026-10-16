import { describe, expect, it } from "vitest";
import { missingMatchReason } from "./matchContext";

describe("directional missing match explanations", () => {
  it("asks the viewer to vote only when the viewer has no votes", () => {
    expect(missingMatchReason("you", false)).toBe("For you: vote on candy to calculate this score");
    expect(missingMatchReason("them", false)).toBe("For them: they need to vote on candy to calculate this score");
  });
  it("does not invent a missing-votes reason when votes exist or are private/unknown", () => {
    for (const voted of [true, undefined, null]) {
      expect(missingMatchReason("you", voted)).toBe("For you: not enough voting data");
      expect(missingMatchReason("them", voted)).toBe("For them: not enough voting data");
    }
  });
});
