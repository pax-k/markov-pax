import { describe, expect, test } from "bun:test";
import {
  MarkovChain,
  matrixMultiply,
  matrixPower,
} from "../../index.ts";

function expectMatrixClose(actual: number[][], expected: number[][], tolerance = 1e-8) {
  for (let i = 0; i < actual.length; i++) {
    for (let j = 0; j < actual[i]!.length; j++) {
      expect(Math.abs(actual[i]![j]! - expected[i]![j]!)).toBeLessThanOrEqual(tolerance);
    }
  }
}

describe("theory example: Chapman-Kolmogorov equation", () => {
  test("checks P^(m+n) = P^m P^n", () => {
    const chain = MarkovChain.from({
      A: { A: 0.6, B: 0.4 },
      B: { A: 0.3, B: 0.7 },
    });

    const m = 2;
    const n = 3;

    // Chapman-Kolmogorov: P^(m+n) equals P^m multiplied by P^n.
    const left = matrixPower(chain.matrix, m + n);
    const right = matrixMultiply(matrixPower(chain.matrix, m), matrixPower(chain.matrix, n));

    expectMatrixClose(left, right);
  });
});
