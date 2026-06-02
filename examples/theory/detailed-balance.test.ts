import { describe, expect, test } from "bun:test";
import { MarkovChain } from "../../index.ts";

function expectClose(actual: number, expected: number, tolerance = 1e-8) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

describe("theory example: detailed balance", () => {
  test("checks reversibility with pi_i P_ij = pi_j P_ji", () => {
    const chain = MarkovChain.from({
      A: { A: 0.8, B: 0.2 },
      B: { A: 0.4, B: 0.6 },
    });

    const pi = chain.stationary();

    // Detailed balance for A and B.
    const flowAB = pi.A * chain.transitionProbability("A", "B");
    const flowBA = pi.B * chain.transitionProbability("B", "A");

    expectClose(flowAB, flowBA);
  });
});
