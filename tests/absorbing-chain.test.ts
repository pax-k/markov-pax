import { describe, expect, test } from "bun:test";
import { AbsorbingChain } from "../index.ts";

function expectClose(actual: number, expected: number, tolerance = 1e-8) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

function sum(values: Iterable<number>) {
  return Array.from(values).reduce((total, value) => total + value, 0);
}

function expectDistribution(distribution: Record<string, number>, tolerance = 1e-8) {
  for (const value of Object.values(distribution)) {
    expect(value).toBeGreaterThanOrEqual(-tolerance);
    expect(value).toBeLessThanOrEqual(1 + tolerance);
  }
  expectClose(sum(Object.values(distribution)), 1, tolerance);
}

describe("AbsorbingChain", () => {
  test("computes absorption probabilities and expected time to absorption", () => {
    const chain = AbsorbingChain.from({
      Start: { Work: 0.8, Churn: 0.2 },
      Work: { Work: 0.6, Success: 0.3, Churn: 0.1 },
      Success: { Success: 1 },
      Churn: { Churn: 1 },
    });

    expect(chain.absorbingStates()).toEqual(["Success", "Churn"]);
    expect(chain.transientStates()).toEqual(["Start", "Work"]);

    const probabilities = chain.absorptionProbabilities();
    expectClose(probabilities.Start.Success, 0.6);
    expectClose(probabilities.Start.Churn, 0.4);
    expectClose(probabilities.Work.Success, 0.75);
    expectClose(probabilities.Work.Churn, 0.25);
    expectDistribution(probabilities.Success);
    expectDistribution(probabilities.Churn);

    const times = chain.expectedTimeToAbsorption();
    expectClose(times.Start, 3);
    expectClose(times.Work, 2.5);
    expectClose(times.Success, 0);
    expectClose(times.Churn, 0);
  });

  test("rejects chains without absorbing states and keeps all absorption rows normalized", () => {
    expect(() => AbsorbingChain.from({
      A: { B: 1 },
      B: { A: 1 },
    })).toThrow(/absorbing/i);

    const chain = AbsorbingChain.from({
      Start: { Retry: 0.4, Done: 0.6 },
      Retry: { Start: 0.5, Failed: 0.5 },
      Done: { Done: 1 },
      Failed: { Failed: 1 },
    });

    const probabilities = chain.absorptionProbabilities();
    expectDistribution(probabilities.Start);
    expectDistribution(probabilities.Retry);
    expectDistribution(probabilities.Done);
    expectDistribution(probabilities.Failed);
  });
});
