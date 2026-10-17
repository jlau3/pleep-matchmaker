import { describe, expect, it } from "vitest";
import { currentStep, setupSteps, type SetupProgress } from "./setup";

const empty: SetupProgress = { name: false, code: false, picture: false, voted: false, friends: false };

describe("setupSteps", () => {
  it("groups profile fields into one of four main steps", () => {
    const steps = setupSteps(empty);
    expect(steps.map((step) => step.id)).toEqual(["profile", "vote", "friends", "tiers"]);
    expect(steps.every((step) => !step.done)).toBe(true);
    expect(currentStep(steps).id).toBe("profile");
  });

  it("checks profile fields independently and points to the missing picture", () => {
    const steps = setupSteps({ ...empty, name: true, code: true });
    expect(steps[0].done).toBe(false);
    expect(currentStep(steps).id).toBe("profile");
    expect(currentStep(steps).cta).toBe("Choose my icon");
    expect(currentStep(steps).href).toBe("/profile?setup=profile");
  });

  it("keeps completed tasks checked even when done out of order", () => {
    const steps = setupSteps({ ...empty, code: true, voted: true, friends: true });
    expect(steps.filter((step) => step.done).map((step) => step.id)).toEqual(["vote", "friends"]);
    expect(currentStep(steps).id).toBe("profile");
    expect(currentStep(steps).cta).toBe("Add my name");
  });

  it("unchecks a field if its saved value is removed", () => {
    expect(currentStep(setupSteps({ ...empty, name: true, code: true, picture: true })).id).toBe("vote");
    expect(currentStep(setupSteps({ ...empty, name: true, code: true, picture: false })).id).toBe("profile");
  });

  it("ends on the Tier List after the first three main steps are done", () => {
    const steps = setupSteps({ name: true, code: true, picture: true, voted: true, friends: true });
    expect(currentStep(steps).id).toBe("tiers");
    expect(currentStep(steps).href).toBe("/tiers?pool=everyone");
    expect(steps.filter((step) => step.done)).toHaveLength(3);
  });
});
