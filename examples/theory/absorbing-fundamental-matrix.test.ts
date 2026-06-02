import { describe, expect, test } from "bun:test";
import { AbsorbingChain } from "../../index.ts";

function expectClose(actual: number, expected: number, tolerance = 1e-8) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

describe("theory example: absorbing fundamental matrix", () => {
  test("uses the SDK API that wraps N = (I - Q)^-1", () => {
    const chain = AbsorbingChain.from({
      Start: { Work: 0.8, Failed: 0.2 },
      Work: { Work: 0.5, Succeeded: 0.4, Failed: 0.1 },
      Succeeded: { Succeeded: 1 },
      Failed: { Failed: 1 },
    });

    // Internally, absorbing-chain analysis uses N = (I - Q)^-1.
    const probabilities = chain.absorptionProbabilities();
    const time = chain.expectedTimeToAbsorption();

    expectClose(probabilities.Work.Succeeded, 0.8);
    expectClose(probabilities.Start.Succeeded, 0.64);
    expect(time.Start).toBeGreaterThan(time.Succeeded);
  });
});
