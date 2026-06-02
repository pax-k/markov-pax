import { describe, expect, test } from "bun:test";
import {
  MDP,
  POMDP,
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

describe("MDP", () => {
  const mdp = MDP.from({
    states: ["Low", "High"],
    actions: ["Order", "Hold"],
    discount: 0.9,
    transition: {
      Low: {
        Order: { High: 0.9, Low: 0.1 },
        Hold: { Low: 0.85, High: 0.15 },
      },
      High: {
        Order: { High: 0.95, Low: 0.05 },
        Hold: { High: 0.65, Low: 0.35 },
      },
    },
    reward: {
      Low: { Order: 1, Hold: -2 },
      High: { Order: 0, Hold: 3 },
    },
  });

  test("finds and evaluates optimal inventory policies", () => {
    const result = mdp.valueIteration();
    expect(result.policy.Low).toBe("Order");
    expect(result.policy.High).toBe("Hold");

    const evaluation = mdp.evaluatePolicy(result.policy);
    expect(evaluation.Low).toBeGreaterThan(0);
    expect(evaluation.High).toBeGreaterThan(evaluation.Low);

    const policyResult = mdp.policyIteration();
    expect(policyResult.policy).toEqual(result.policy);
    expect(policyResult.delta).toBe(0);
  });

  test("simulates policies and rejects invalid MDP configs/runtime inputs", () => {
    const events = mdp.simulate("Low", { Low: "Order", High: "Hold" }, 2);
    expect(events).toHaveLength(2);
    expect(events[0]!.state).toBe("Low");

    expect(() => MDP.from({
      states: ["Low"],
      actions: ["Hold"],
      discount: 1,
      transition: { Low: { Hold: { Low: 1 } } },
      reward: { Low: { Hold: 1 } },
    })).toThrow(/discount/i);

    expect(() => MDP.from({
      states: ["Low"],
      actions: ["Hold"],
      discount: 0.9,
      transition: { Low: { Hold: { Low: 0.5 } } },
      reward: { Low: { Hold: 1 } },
    })).toThrow(/sum to 1/i);

    const invalidPolicy = {
      Low: "Cancel",
      High: "Hold",
    } as unknown as Record<"Low" | "High", "Order" | "Hold">;
    expect(() => mdp.evaluatePolicy(invalidPolicy)).toThrow(/unknown action/i);
    expect(() => mdp.simulate("Missing" as "Low", { Low: "Order", High: "Hold" }, 1)).toThrow(/unknown state/i);
    expect(() => mdp.valueIteration({ maxIterations: 0 })).toThrow(/did not converge/i);
    expect(() => mdp.policyIteration({ maxIterations: 0 })).toThrow(/did not converge/i);
  });
});

describe("POMDP", () => {
  test("updates robot localization beliefs and keeps probabilities normalized", () => {
    const pomdp = POMDP.from({
      states: ["Hall", "Door"],
      actions: ["Move"],
      observations: ["see-door", "see-wall"],
      transition: {
        Hall: { Move: { Hall: 0.7, Door: 0.3 } },
        Door: { Move: { Hall: 0.2, Door: 0.8 } },
      },
      observation: {
        Hall: { Move: { "see-door": 0.2, "see-wall": 0.8 } },
        Door: { Move: { "see-door": 0.9, "see-wall": 0.1 } },
      },
    });

    const updated = pomdp.updateBelief({
      belief: { Hall: 0.6, Door: 0.4 },
      action: "Move",
      observation: "see-door",
    });

    expectDistribution(updated);
    expect(updated.Door).toBeGreaterThan(updated.Hall);
  });

  test("rejects invalid configs, unknown inputs, and impossible belief updates", () => {
    expect(() => POMDP.from({
      states: ["Hall"],
      actions: ["Move"],
      observations: ["see-wall"],
      transition: { Hall: { Move: { Hall: 1 } } },
      observation: { Hall: { Move: {} } },
    })).toThrow(/positive|sum to 1/i);

    const pomdp = POMDP.from({
      states: ["Hall", "Door"],
      actions: ["Move"],
      observations: ["see-door", "impossible"],
      transition: {
        Hall: { Move: { Hall: 1, Door: 0 } },
        Door: { Move: { Hall: 0, Door: 1 } },
      },
      observation: {
        Hall: { Move: { "see-door": 1, impossible: 0 } },
        Door: { Move: { "see-door": 1, impossible: 0 } },
      },
    });

    expect(() => pomdp.updateBelief({
      belief: { Hall: 1, Door: 0 },
      action: "Teleport" as "Move",
      observation: "see-door",
    })).toThrow(/unknown action/i);

    expect(() => pomdp.updateBelief({
      belief: { Hall: 1, Door: 0 },
      action: "Move",
      observation: "missing" as "see-door",
    })).toThrow(/unknown observation/i);

    expect(() => pomdp.updateBelief({
      belief: { Hall: 1, Door: 0 },
      action: "Move",
      observation: "impossible",
    })).toThrow(/zero probability/i);
  });
});
