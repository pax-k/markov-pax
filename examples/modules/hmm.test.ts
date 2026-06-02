import { describe, expect, test } from "bun:test";
import {
  HiddenMarkovModel,
  SeededRng,
} from "../../index.ts";

function sum(values: Iterable<number>) {
  return Array.from(values).reduce((total, value) => total + value, 0);
}

describe("module example: HiddenMarkovModel", () => {
  test("scores observations, decodes hidden states, and samples sequences", () => {
    const model = HiddenMarkovModel.from({
      states: ["Calm", "Busy"],
      observations: ["few-events", "many-events"],
      initial: { Calm: 0.7, Busy: 0.3 },
      transition: {
        Calm: { Calm: 0.8, Busy: 0.2 },
        Busy: { Calm: 0.35, Busy: 0.65 },
      },
      emission: {
        Calm: { "few-events": 0.85, "many-events": 0.15 },
        Busy: { "few-events": 0.2, "many-events": 0.8 },
      },
    });

    const observations = ["few-events", "many-events", "many-events"] as const;
    const forward = model.forward(observations);
    const decoded = model.viterbi(observations);
    const sample = model.sample(3, { rng: new SeededRng(3) });

    expect(forward.probability).toBeGreaterThan(0);
    expect(sum(Object.values(forward.posterior))).toBeCloseTo(1);
    expect(decoded.path.at(-1)).toBe("Busy");
    expect(model.backward(observations)).toHaveLength(3);
    expect(sample.states).toHaveLength(3);
  });
});
