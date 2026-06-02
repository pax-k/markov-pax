import { describe, expect, test } from "bun:test";
import { POMDP } from "../../index.ts";

function sum(values: Iterable<number>) {
  return Array.from(values).reduce((total, value) => total + value, 0);
}

describe("theory example: Bayesian filtering", () => {
  test("updates a belief distribution using transition and observation likelihoods", () => {
    const pomdp = POMDP.from({
      states: ["Clean", "Dirty"],
      actions: ["Inspect"],
      observations: ["looks-clean", "looks-dirty"],
      transition: {
        Clean: { Inspect: { Clean: 0.9, Dirty: 0.1 } },
        Dirty: { Inspect: { Clean: 0.2, Dirty: 0.8 } },
      },
      observation: {
        Clean: { Inspect: { "looks-clean": 0.85, "looks-dirty": 0.15 } },
        Dirty: { Inspect: { "looks-clean": 0.1, "looks-dirty": 0.9 } },
      },
    });

    // POMDP belief updates are Bayesian filtering over hidden states.
    const posterior = pomdp.updateBelief({
      belief: { Clean: 0.6, Dirty: 0.4 },
      action: "Inspect",
      observation: "looks-dirty",
    });

    expect(sum(Object.values(posterior))).toBeCloseTo(1);
    expect(posterior.Dirty).toBeGreaterThan(posterior.Clean);
  });
});
