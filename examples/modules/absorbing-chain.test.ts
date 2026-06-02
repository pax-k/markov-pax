import { describe, expect, test } from "bun:test";
import { AbsorbingChain } from "../../index.ts";

function expectClose(actual: number, expected: number, tolerance = 1e-8) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

describe("module example: AbsorbingChain", () => {
  test("computes eventual success/failure probabilities", () => {
    const onboarding = AbsorbingChain.from({
      Invited: { Activated: 0.75, Dropped: 0.25 },
      Activated: { Activated: 0.2, Retained: 0.7, Dropped: 0.1 },
      Retained: { Retained: 1 },
      Dropped: { Dropped: 1 },
    });

    const probabilities = onboarding.absorptionProbabilities();
    const time = onboarding.expectedTimeToAbsorption();

    expect(onboarding.absorbingStates()).toEqual(["Retained", "Dropped"]);
    expect(probabilities.Invited.Retained).toBeGreaterThan(probabilities.Invited.Dropped);
    expectClose(probabilities.Invited.Retained + probabilities.Invited.Dropped, 1);
    expect(time.Invited).toBeGreaterThan(1);
  });
});
