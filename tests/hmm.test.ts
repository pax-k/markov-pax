import { describe, expect, test } from "bun:test";
import {
  HiddenMarkovModel,
  SeededRng,
} from "../index.ts";

function expectClose(actual: number, expected: number, tolerance = 1e-8) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

function sum(values: Iterable<number>) {
  return Array.from(values).reduce((total, value) => total + value, 0);
}

function expectDistribution(distribution: Record<string, number>, tolerance = 1e-8) {
  for (const value of Object.values(distribution)) {
    expect(value).toBeGreaterThanOrEqual(-tolerance);
    expect(value).toBeLessThanOrEqual(1 + tolerance);
  }
  expectClose(sum(Object.values(distribution)), 1, tolerance);
}

describe("HiddenMarkovModel", () => {
  const medical = HiddenMarkovModel.from({
    states: ["Healthy", "Sick"],
    observations: ["normal", "dizzy", "fever"],
    initial: { Healthy: 0.8, Sick: 0.2 },
    transition: {
      Healthy: { Healthy: 0.7, Sick: 0.3 },
      Sick: { Healthy: 0.4, Sick: 0.6 },
    },
    emission: {
      Healthy: { normal: 0.8, dizzy: 0.15, fever: 0.05 },
      Sick: { normal: 0.1, dizzy: 0.3, fever: 0.6 },
    },
  });

  test("computes forward probabilities, Viterbi paths, and samples", () => {
    const probability = medical.sequenceProbability(["normal", "fever", "fever"]);
    expect(probability).toBeGreaterThan(0);
    expect(probability).toBeLessThan(1);

    const forward = medical.forward(["normal", "fever", "fever"]);
    expectDistribution(forward.posterior);

    const decoded = medical.viterbi(["normal", "fever", "fever"]);
    expect(decoded.path.at(-1)).toBe("Sick");

    const sample = medical.sample(3, { rng: new SeededRng(5) });
    expect(sample.states).toHaveLength(3);
    expect(sample.observations).toHaveLength(3);
  });

  test("computes backward recursion values", () => {
    const beta = medical.backward(["normal", "fever", "fever"]);

    expectClose(beta[2]![0]!, 1);
    expectClose(beta[2]![1]!, 1);
    expectClose(beta[1]![0]!, 0.215);
    expectClose(beta[1]![1]!, 0.38);
    expectClose(beta[0]![0]!, 0.075925);
    expectClose(beta[0]![1]!, 0.1411);
  });

  test("rejects invalid configs, empty sequences, unknown observations, and zero-probability sequences", () => {
    expect(() => HiddenMarkovModel.from({
      states: ["A", "B"],
      observations: ["x"],
      initial: { A: 1, B: 0 },
      transition: {
        A: { A: 1 },
        B: { B: 1 },
      },
      emission: {
        A: { x: 1 },
        B: {},
      },
    })).toThrow(/positive|sum to 1/i);

    const hmm = HiddenMarkovModel.from({
      states: ["A", "B"],
      observations: ["x", "y"],
      initial: { A: 1, B: 0 },
      transition: {
        A: { A: 1, B: 0 },
        B: { A: 0, B: 1 },
      },
      emission: {
        A: { x: 1, y: 0 },
        B: { x: 0, y: 1 },
      },
    });

    expect(() => medical.backward([])).toThrow(/empty|not be empty/i);
    expect(() => medical.backward(["missing" as "normal"])).toThrow(/unknown observation/i);
    expect(() => hmm.forward(["missing" as "x"])).toThrow(/unknown observation/i);
    expect(() => hmm.viterbi(["missing" as "x"])).toThrow(/unknown observation/i);
    expect(() => hmm.sequenceProbability(["y"])).toThrow(/zero probability/i);
  });
});
