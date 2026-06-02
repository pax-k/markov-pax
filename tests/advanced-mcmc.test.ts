import { describe, expect, test } from "bun:test";
import {
  SeededRng,
  diagnoseChain,
  diagnoseChains,
  gaussianRandomWalkProposal,
  gelmanRubinRHat,
  hamiltonianMonteCarlo,
  mala,
  validateGradient,
} from "../index.ts";

describe("advanced MCMC samplers and diagnostics", () => {
  const logNormal = (x: number) => -0.5 * x * x;
  const gradLogNormal = (x: number) => -x;

  test("runs MALA, HMC, Gaussian proposals, and diagnostics", () => {
    const malaResult = mala({
      initial: 0,
      logTarget: logNormal,
      gradientLogTarget: gradLogNormal,
      stepSize: 0.5,
      rng: new SeededRng(5),
    }).run({ iterations: 1_000, burnIn: 100, thin: 2 });
    expect(Math.abs(malaResult.mean())).toBeLessThan(0.25);
    expect(malaResult.variance()).toBeGreaterThan(0);
    expect(malaResult.acceptanceRate).toBeGreaterThan(0.4);

    const hmcResult = hamiltonianMonteCarlo({
      initial: 0,
      logTarget: logNormal,
      gradientLogTarget: gradLogNormal,
      stepSize: 0.2,
      leapfrogSteps: 5,
      rng: new SeededRng(6),
    }).run({ iterations: 500, burnIn: 50 });
    expect(Math.abs(hmcResult.mean())).toBeLessThan(0.35);
    expect(hmcResult.variance()).toBeGreaterThan(0);

    expect(Number.isFinite(gaussianRandomWalkProposal(1)(0, new SeededRng(1)))).toBe(true);
    expect(validateGradient(logNormal, gradLogNormal, 0.7)).toBeLessThan(1e-6);
    expect(diagnoseChain([1, 2, 3, 4]).effectiveSampleSize).toBeGreaterThan(0);
    expect(gelmanRubinRHat([[1, 2, 3], [1.1, 2.1, 3.1]])).toBeGreaterThan(0);
    expect(gelmanRubinRHat([[1, 1], [1, 1]])).toBe(1);
    expect(gelmanRubinRHat([[1, 1], [2, 2]])).toBe(Number.POSITIVE_INFINITY);
    expect(diagnoseChains([[1, 2, 3], [1.1, 2.1, 3.1]]).summaries).toHaveLength(2);
  });

  test("rejects invalid samplers, run options, and diagnostics", () => {
    expect(() => mala({ initial: 0, logTarget: logNormal, gradientLogTarget: gradLogNormal, stepSize: 0 })).toThrow();
    expect(() => gaussianRandomWalkProposal(0)).toThrow();
    expect(() => validateGradient(logNormal, gradLogNormal, 0, 0)).toThrow();
    expect(() => hamiltonianMonteCarlo({ initial: 0, logTarget: logNormal, gradientLogTarget: gradLogNormal, stepSize: 0.1, leapfrogSteps: 0 })).toThrow();
    expect(() => hamiltonianMonteCarlo({ initial: 0, logTarget: logNormal, gradientLogTarget: gradLogNormal, stepSize: 0.1, leapfrogSteps: 1, mass: 0 })).toThrow();
    expect(() => mala({ initial: 0, logTarget: () => Number.NaN, gradientLogTarget: gradLogNormal, stepSize: 0.1 }).run({ iterations: 1 })).toThrow();
    expect(() => mala({ initial: 0, logTarget: logNormal, gradientLogTarget: () => Number.NaN, stepSize: 0.1 }).run({ iterations: 1 })).toThrow();
    expect(() => hamiltonianMonteCarlo({ initial: 0, logTarget: logNormal, gradientLogTarget: () => Number.NaN, stepSize: 0.1, leapfrogSteps: 1 }).run({ iterations: 1 })).toThrow();
    expect(() => hamiltonianMonteCarlo({ initial: 0, logTarget: () => Number.NaN, gradientLogTarget: gradLogNormal, stepSize: 0.1, leapfrogSteps: 1 }).run({ iterations: 1 })).toThrow();
    expect(() => mala({ initial: 0, logTarget: logNormal, gradientLogTarget: gradLogNormal, stepSize: 0.1 }).run({ iterations: 0 })).toThrow();
    expect(() => mala({ initial: 0, logTarget: logNormal, gradientLogTarget: gradLogNormal, stepSize: 0.1 }).run({ iterations: 2, burnIn: -1 })).toThrow();
    expect(() => mala({ initial: 0, logTarget: logNormal, gradientLogTarget: gradLogNormal, stepSize: 0.1 }).run({ iterations: 2, burnIn: 2 })).toThrow();
    expect(() => mala({ initial: 0, logTarget: logNormal, gradientLogTarget: gradLogNormal, stepSize: 0.1 }).run({ iterations: 2, thin: 0 })).toThrow();
    expect(() => diagnoseChain([1])).toThrow();
    expect(() => gelmanRubinRHat([[1, 2]])).toThrow();
    expect(() => gelmanRubinRHat([[1, 2], [1]])).toThrow();
  });
});
