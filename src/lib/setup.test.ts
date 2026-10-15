import { describe, expect, it } from "vitest";
import { currentStep, setupSteps } from "./setup";

describe("setupSteps", () => {
  it("starts at Profile for a brand new player", () => {
    expect(currentStep(setupSteps({ profile: false, voted: false, friends: false })).id).toBe("profile");
  });

  it("points at the first step not done, whatever order the others were done in", () => {
    expect(currentStep(setupSteps({ profile: true, voted: false, friends: true })).id).toBe("vote");
    expect(currentStep(setupSteps({ profile: false, voted: true, friends: true })).id).toBe("profile");
  });

  it("ends on the Tier List, which only the visit itself completes", () => {
    const steps = setupSteps({ profile: true, voted: true, friends: true });
    expect(currentStep(steps).id).toBe("tiers");
    expect(steps.filter((s) => s.done)).toHaveLength(3);
  });
});
