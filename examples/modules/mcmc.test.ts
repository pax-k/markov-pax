import { describe, expect, test } from "bun:test";
import {
  SeededRng,
  gibbsSampler,
  metropolisHastings,
} from "../../index.ts";

describe("module example: MCMC", () => {
  test("runs Metropolis-Hastings and Gibbs samplers", () => {
    const mh = metropolisHastings({
      initial: 0,
      rng: new SeededRng(11),
      logTarget: (x: number) => -0.5 * x * x,
      proposal: (x: number, rng) => x + rng.normal(0, 1),
    }).run({ iterations: 2_000, burnIn: 500 });

    expect(mh.samples).toHaveLength(1_500);
    expect(mh.acceptanceRate).toBeGreaterThan(0.3);
    expect(Math.abs(mh.mean())).toBeLessThan(0.2);

    const gibbs = gibbsSampler({
      initial: { x: 0, y: 0 },
      rng: new SeededRng(22),
      steps: [
        { key: "x", sample: (state, rng) => 0.5 * state.y + rng.normal(0, 1) },
        { key: "y", sample: (state, rng) => 0.5 * state.x + rng.normal(0, 1) },
      ],
    }).run({ iterations: 20 });

    expect(gibbs.samples).toHaveLength(20);
    expect(Number.isFinite(gibbs.samples[0]!.x)).toBe(true);
  });
});
