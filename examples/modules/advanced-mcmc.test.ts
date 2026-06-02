import { describe, expect, test } from "bun:test";
import { SeededRng, diagnoseChain, hamiltonianMonteCarlo, mala } from "../../index.ts";

describe("module example: advanced MCMC", () => {
  test("runs gradient-informed samplers and summarizes samples", () => {
    const logTarget = (x: number) => -0.5 * x * x;
    const gradient = (x: number) => -x;

    const malaSamples = mala({ initial: 0, logTarget, gradientLogTarget: gradient, stepSize: 0.5, rng: new SeededRng(11) })
      .run({ iterations: 300, burnIn: 50 }).samples;
    const hmcSamples = hamiltonianMonteCarlo({ initial: 0, logTarget, gradientLogTarget: gradient, stepSize: 0.2, leapfrogSteps: 4, rng: new SeededRng(12) })
      .run({ iterations: 200, burnIn: 50 }).samples;

    expect(diagnoseChain(malaSamples).effectiveSampleSize).toBeGreaterThan(0);
    expect(Math.abs(diagnoseChain(hmcSamples).mean)).toBeLessThan(0.5);
  });
});
