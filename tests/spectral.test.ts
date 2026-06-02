import { describe, expect, test } from "bun:test";
import {
  MarkovChain,
  detailedBalanceResiduals,
  dominantEigenpair,
  eigenvalues2x2,
  estimateMixingTime,
  isReversible,
  mixingDistance,
  powerIteration,
  relaxationTime,
  spectralGap,
} from "../index.ts";

describe("spectral finite-chain utilities", () => {
  test("computes eigen, gap, reversibility, and mixing quantities", () => {
    const matrix = [
      [0.75, 0.25],
      [0.25, 0.75],
    ];
    expect(powerIteration(matrix).value).toBeCloseTo(1);
    expect(powerIteration([[2]], { tolerance: 1e-12 }).value).toBeCloseTo(2);
    expect(dominantEigenpair(matrix).vector).toHaveLength(2);
    expect(eigenvalues2x2(matrix)[1]).toBeCloseTo(0.5);
    expect(spectralGap(matrix)).toBeCloseTo(0.5);
    expect(relaxationTime(matrix)).toBeCloseTo(2);
    expect(spectralGap([[1]])).toBe(1);
    expect(spectralGap([
      [0.5, 0.5, 0],
      [0.25, 0.5, 0.25],
      [0, 0.5, 0.5],
    ])).toBeGreaterThanOrEqual(0);

    const chain = MarkovChain.from({ A: { A: 0.75, B: 0.25 }, B: { A: 0.25, B: 0.75 } });
    expect(estimateMixingTime(chain, { A: 1 }, { tolerance: 0.01 })).toBeGreaterThan(0);
    expect(mixingDistance([0.7, 0.3], [0.5, 0.5])).toBeCloseTo(0.2);
    expect(isReversible(chain)).toBe(true);
    expect(detailedBalanceResiduals(chain)[0]!.residual).toBeCloseTo(0);
  });

  test("rejects unsupported or nonconvergent spectral requests", () => {
    expect(() => powerIteration([[0, 0], [0, 0]])).toThrow();
    expect(() => powerIteration([[2, 1], [0, 1]], { maxIterations: 1, tolerance: 0 })).toThrow();
    expect(() => powerIteration([[0.9, 0.1], [0.2, 0.8]], { maxIterations: 0 })).toThrow();
    expect(() => eigenvalues2x2([[1]])).toThrow();
    expect(() => eigenvalues2x2([[0, -1], [1, 0]])).toThrow();
    expect(() => relaxationTime([[0, 1], [1, 0]])).toThrow();
    const periodic = MarkovChain.from({ A: { B: 1 }, B: { A: 1 } });
    expect(() => estimateMixingTime(periodic, { A: 1 }, { tolerance: 0, maxIterations: 0 })).toThrow();
  });
});
