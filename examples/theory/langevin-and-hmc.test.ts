import { describe, expect, test } from "bun:test";
import { SeededRng, hamiltonianMonteCarlo, mala } from "../../index.ts";

describe("theory example: Langevin and Hamiltonian MCMC", () => {
  test("uses gradients to build Markov chains with a target stationary law", () => {
    const logTarget = (x: number) => -0.5 * x * x;
    const gradient = (x: number) => -x;

    const malaMean = mala({ initial: 2, logTarget, gradientLogTarget: gradient, stepSize: 0.5, rng: new SeededRng(1) })
      .run({ iterations: 500, burnIn: 100 }).mean();
    const hmcMean = hamiltonianMonteCarlo({ initial: 2, logTarget, gradientLogTarget: gradient, stepSize: 0.2, leapfrogSteps: 5, rng: new SeededRng(2) })
      .run({ iterations: 300, burnIn: 50 }).mean();

    expect(Math.abs(malaMean)).toBeLessThan(0.4);
    expect(Math.abs(hmcMean)).toBeLessThan(0.4);
  });
});
