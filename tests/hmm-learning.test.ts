import { describe, expect, test } from "bun:test";
import { baumWelch, supervisedHMMFit } from "../index.ts";

describe("HMM learning", () => {
  test("fits supervised HMMs and improves Baum-Welch likelihood", () => {
    const supervised = supervisedHMMFit({
      states: ["Healthy", "Sick"],
      observations: ["normal", "fever"],
      smoothing: 0.5,
      sequences: [
        { states: ["Healthy", "Healthy", "Sick"], observations: ["normal", "normal", "fever"] },
        { states: ["Sick", "Sick"], observations: ["fever", "fever"] },
      ],
    });
    expect(supervised.sequenceProbability(["normal", "fever"])).toBeGreaterThan(0);

    const initialModel = {
      states: ["Healthy", "Sick"] as const,
      observations: ["normal", "fever"] as const,
      initial: { Healthy: 0.6, Sick: 0.4 },
      transition: {
        Healthy: { Healthy: 0.6, Sick: 0.4 },
        Sick: { Healthy: 0.4, Sick: 0.6 },
      },
      emission: {
        Healthy: { normal: 0.55, fever: 0.45 },
        Sick: { normal: 0.45, fever: 0.55 },
      },
    };
    const trained = baumWelch({
      states: ["Healthy", "Sick"],
      observations: ["normal", "fever"],
      sequences: [["normal", "normal", "fever", "fever"], ["fever", "fever", "normal"]],
      initialModel,
      maxIterations: 5,
      tolerance: 0,
    });
    expect(trained.logLikelihoods.at(-1)!).toBeGreaterThanOrEqual(trained.logLikelihoods[0]! - 1e-8);
    expect(trained.model.sequenceProbability(["normal", "fever"])).toBeGreaterThan(0);

    const converged = baumWelch({
      states: ["A", "B"],
      observations: ["x", "y"],
      sequences: [["x", "y"]],
      maxIterations: 2,
      tolerance: 1e9,
    });
    expect(converged.converged).toBe(true);
  });

  test("rejects invalid HMM training data", () => {
    expect(() => supervisedHMMFit({ states: ["A"], observations: ["x"], sequences: [] })).toThrow();
    expect(() => supervisedHMMFit({ states: ["A"], observations: ["x"], sequences: [{ states: ["A"], observations: [] }] })).toThrow();
    expect(() => supervisedHMMFit({ states: ["A"], observations: ["x"], sequences: [{ states: ["A"], observations: ["x"] }], smoothing: -1 })).toThrow();
    expect(() => baumWelch({ states: ["A"], observations: ["x"], sequences: [] })).toThrow();
    expect(() => baumWelch({ states: ["A"], observations: ["x"], sequences: [["x"]], maxIterations: 0 })).toThrow();
    expect(() => baumWelch({ states: ["A"], observations: ["x"], sequences: [["missing" as "x"]] })).toThrow();
  });
});
