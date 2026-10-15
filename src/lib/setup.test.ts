import { describe, expect, it } from "vitest";
import { currentStep, setupSteps, type SetupProgress } from "./setup";

const empty: SetupProgress = { name: false, code: false, picture: false, voted: false, friends: false };

describe("setupSteps", () => {
  it("lists every concrete task for a new player", () => {
    const steps = setupSteps(empty);
    expect(steps.map((step) => step.id)).toEqual(["name", "code", "picture", "vote", "friends", "tiers"]);
    expect(steps.every((step) => !step.done)).toBe(true);
    expect(currentStep(steps).id).toBe("name");
  });

  it("checks profile fields independently and points to the missing picture", () => {
    const steps = setupSteps({ ...empty, name: true, code: true });
    expect(steps.slice(0, 3).map((step) => step.done)).toEqual([true, true, false]);
    expect(currentStep(steps).id).toBe("picture");
    expect(currentStep(steps).href).toBe("/profile?setup=profile");
  });

  it("keeps completed tasks checked even when done out of order", () => {
    const steps = setupSteps({ ...empty, code: true, voted: true, friends: true });
    expect(steps.filter((step) => step.done).map((step) => step.id)).toEqual(["code", "vote", "friends"]);
    expect(currentStep(steps).id).toBe("name");
  });

  it("unchecks a field if its saved value is removed", () => {
    expect(currentStep(setupSteps({ ...empty, name: true, code: true, picture: true })).id).toBe("vote");
    expect(currentStep(setupSteps({ ...empty, name: true, code: true, picture: false })).id).toBe("picture");
  });

  it("ends on the Tier List after the first five tasks are done", () => {
    const steps = setupSteps({ name: true, code: true, picture: true, voted: true, friends: true });
    expect(currentStep(steps).id).toBe("tiers");
    expect(steps.filter((step) => step.done)).toHaveLength(5);
  });
});
