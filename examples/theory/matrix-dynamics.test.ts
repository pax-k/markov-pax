import { describe, expect, test } from "bun:test";
import {
  MarkovChain,
  matrixPower,
  rowVectorMatrixMultiply,
} from "../../index.ts";

function expectClose(actual: number, expected: number, tolerance = 1e-8) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

describe("theory example: matrix dynamics", () => {
  test("computes mu_n = mu_0 P^n", () => {
    const chain = MarkovChain.from({
      A: { A: 0.7, B: 0.3 },
      B: { A: 0.2, B: 0.8 },
    });

    // Markov-chain dynamics: mu_n = mu_0 P^n.
    const direct = chain.distributionAfter({ A: 1, B: 0 }, 3);
    const matrix = rowVectorMatrixMultiply([1, 0], matrixPower(chain.matrix, 3));

    expectClose(direct.A, matrix[0]!);
    expectClose(direct.B, matrix[1]!);
  });
});
