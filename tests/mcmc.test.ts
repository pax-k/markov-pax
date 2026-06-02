import { describe, expect, test } from "bun:test";
import {
  SeededRng,
  gibbsSampler,
  metropolisHastings,
} from "../index.ts";

function expectClose(actual: number, expected: number, tolerance = 1e-8) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

describe("Metropolis-Hastings", () => {
  test("samples a standard normal target with deterministic RNG", () => {
    const sampler = metropolisHastings({
      initial: 0,
      logTarget: (x: number) => -0.5 * x * x,
      proposal: (x: number, rng) => x + rng.normal(0, 1),
      rng: new SeededRng(1234),
    });

    const result = sampler.run({ iterations: 12_000, burnIn: 2_000 });
    expect(result.samples).toHaveLength(10_000);
    expect(result.acceptanceRate).toBeGreaterThan(0.4);
    expect(result.acceptanceRate).toBeLessThan(0.9);
    expectClose(result.mean(), 0, 0.08);
    expectClose(result.variance(), 1, 0.15);
  });

  test("supports validation and asymmetric proposal ratios", () => {
    const stationary = metropolisHastings({
      initial: 0,
      logTarget: (x: number) => -0.5 * x * x,
      proposal: (x: number) => x,
      logProposalRatio: () => 0,
    }).run({ iterations: 5, burnIn: 1, thin: 2 });
    expect(stationary.samples).toEqual([0, 0]);
    expect(stationary.acceptanceRate).toBe(1);

    const sampler = metropolisHastings({
      initial: 0,
      logTarget: (x: number) => -0.5 * x * x,
      proposal: (x: number) => x,
    });

    expect(() => sampler.run({ iterations: 0 })).toThrow(/iterations/i);
    expect(() => sampler.run({ iterations: 10, burnIn: -1 })).toThrow(/burnIn/i);
    expect(() => sampler.run({ iterations: 10, burnIn: 10 })).toThrow(/burnIn/i);
    expect(() => sampler.run({ iterations: 10, thin: 0 })).toThrow(/thin/i);
  });
});

describe("Gibbs sampler", () => {
  test("runs user-defined conditionals", () => {
    const result = gibbsSampler({
      initial: { x: 0, y: 0 },
      steps: [
        {
          key: "x",
          sample: (state, rng) => 0.5 * state.y + rng.normal(0, 1),
        },
        {
          key: "y",
          sample: (state, rng) => 0.5 * state.x + rng.normal(0, 1),
        },
      ],
      rng: new SeededRng(42),
    }).run({ iterations: 200, burnIn: 50 });

    expect(result.samples).toHaveLength(150);
    expect(Number.isFinite(result.samples[0]!.x)).toBe(true);
    expect(Number.isFinite(result.samples[0]!.y)).toBe(true);
  });

  test("rejects missing conditional steps and nonnumeric summaries", () => {
    expect(() => gibbsSampler({ initial: { x: 0 }, steps: [] })).toThrow(/conditional step/i);

    const result = gibbsSampler({
      initial: { x: 0 },
      steps: [{ key: "x", sample: () => 1 }],
    }).run({ iterations: 3 });
    expect(() => result.mean()).toThrow(/number-valued/i);
  });
});
