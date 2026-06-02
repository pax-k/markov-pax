import { describe, expect, test } from "bun:test";
import {
  HiddenMarkovModel,
  MDP,
  POMDP,
} from "../../index.ts";

function expectClose(actual: number, expected: number, tolerance = 1e-8) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

function sum(values: Iterable<number>) {
  return Array.from(values).reduce((total, value) => total + value, 0);
}

describe("real-world example: medical symptom triage", () => {
  test("infers likely patient condition from noisy symptom observations", () => {
    const triage = HiddenMarkovModel.from({
      states: ["Stable", "Worsening"],
      observations: ["normal", "cough", "fever"],
      initial: { Stable: 0.85, Worsening: 0.15 },
      transition: {
        Stable: { Stable: 0.82, Worsening: 0.18 },
        Worsening: { Stable: 0.25, Worsening: 0.75 },
      },
      emission: {
        Stable: { normal: 0.75, cough: 0.2, fever: 0.05 },
        Worsening: { normal: 0.1, cough: 0.3, fever: 0.6 },
      },
    });

    const observations = ["normal", "cough", "fever", "fever"] as const;
    const posterior = triage.forward(observations).posterior;
    const likelyPath = triage.viterbi(observations).path;

    expectClose(sum(Object.values(posterior)), 1);
    expect(posterior.Worsening).toBeGreaterThan(posterior.Stable);
    expect(likelyPath.at(-1)).toBe("Worsening");
  });
});

describe("real-world example: warehouse replenishment policy", () => {
  test("chooses order/hold/markdown actions for stock-level states", () => {
    const inventory = MDP.from({
      states: ["LowStock", "HealthyStock", "Overstock"],
      actions: ["Order", "Hold", "Markdown"],
      discount: 0.9,
      transition: {
        LowStock: {
          Order: { LowStock: 0.2, HealthyStock: 0.8 },
          Hold: { LowStock: 0.8, HealthyStock: 0.2 },
          Markdown: { LowStock: 1 },
        },
        HealthyStock: {
          Order: { HealthyStock: 0.4, Overstock: 0.6 },
          Hold: { LowStock: 0.2, HealthyStock: 0.7, Overstock: 0.1 },
          Markdown: { LowStock: 0.4, HealthyStock: 0.5, Overstock: 0.1 },
        },
        Overstock: {
          Order: { HealthyStock: 0.1, Overstock: 0.9 },
          Hold: { HealthyStock: 0.3, Overstock: 0.7 },
          Markdown: { HealthyStock: 0.8, Overstock: 0.2 },
        },
      },
      reward: {
        LowStock: { Order: 4, Hold: -5, Markdown: -6 },
        HealthyStock: { Order: 1, Hold: 5, Markdown: 0 },
        Overstock: { Order: -4, Hold: 0, Markdown: 3 },
      },
    });

    const policy = inventory.valueIteration().policy;

    expect(policy.LowStock).toBe("Order");
    expect(policy.HealthyStock).toBe("Hold");
    expect(policy.Overstock).toBe("Markdown");
  });
});

describe("real-world example: robot localization with noisy sensors", () => {
  test("updates belief toward the loading dock after a dock-like scan", () => {
    const robot = POMDP.from({
      states: ["Aisle", "Dock"],
      actions: ["Drive"],
      observations: ["shelf-scan", "dock-scan"],
      transition: {
        Aisle: { Drive: { Aisle: 0.65, Dock: 0.35 } },
        Dock: { Drive: { Aisle: 0.15, Dock: 0.85 } },
      },
      observation: {
        Aisle: { Drive: { "shelf-scan": 0.85, "dock-scan": 0.15 } },
        Dock: { Drive: { "shelf-scan": 0.1, "dock-scan": 0.9 } },
      },
    });

    const belief = robot.updateBelief({
      belief: { Aisle: 0.7, Dock: 0.3 },
      action: "Drive",
      observation: "dock-scan",
    });

    expectClose(sum(Object.values(belief)), 1);
    expect(belief.Dock).toBeGreaterThan(0.7);
    expect(belief.Dock).toBeGreaterThan(belief.Aisle);
  });
});
