import { describe, expect, test } from "bun:test";
import {
  SeededRng,
  matrixMultiply,
  matrixPower,
  normalizeDistribution,
  sampleIndex,
} from "../../index.ts";

function expectClose(actual: number, expected: number, tolerance = 1e-8) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

describe("module example: core utilities", () => {
  test("uses distributions, matrices, seeded RNG, and weighted sampling", () => {
    const distribution = normalizeDistribution({ Trial: 20, Paid: 80 });
    expectClose(distribution.Trial, 0.2);
    expectClose(distribution.Paid, 0.8);

    const transition = [
      [0.7, 0.3],
      [0.2, 0.8],
    ];

    const twoStep = matrixPower(transition, 2);
    expect(matrixMultiply(transition, transition)).toEqual(twoStep);

    const rng = new SeededRng(10);
    const selected = sampleIndex([0.1, 0.9], rng);
    expect([0, 1]).toContain(selected);
  });
});
