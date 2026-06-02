import { describe, expect, test } from "bun:test";
import {
  MarkovChain,
  rowVectorMatrixMultiply,
} from "../../index.ts";

function expectClose(actual: number, expected: number, tolerance = 1e-8) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

describe("theory example: stationary distributions", () => {
  test("checks pi P = pi", () => {
    const chain = MarkovChain.from({
      A: { A: 0.7, B: 0.3 },
      B: { A: 0.4, B: 0.6 },
    });

    const pi = chain.stationary();
    const piVector = chain.toVector(pi);
    const afterStep = rowVectorMatrixMultiply(piVector, chain.matrix);

    // Stationary distribution identity: pi P = pi.
    expectClose(afterStep[0]!, piVector[0]!);
    expectClose(afterStep[1]!, piVector[1]!);
  });
});
