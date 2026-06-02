import { describe, expect, test } from "bun:test";
import {
  ConstrainedMDP,
  MDP,
  MultiObjectiveMDP,
} from "../index.ts";

const config = {
  states: ["Low", "High"] as const,
  actions: ["Order", "Hold"] as const,
  discount: 0.5,
  transition: {
    Low: {
      Order: { High: 1 },
      Hold: { Low: 1 },
    },
    High: {
      Order: { High: 1 },
      Hold: { High: 1 },
    },
  },
  reward: {
    Low: { Order: 5, Hold: 1 },
    High: { Order: 0, Hold: 4 },
  },
};

describe("ConstrainedMDP", () => {
  test("evaluates and solves finite deterministic policies under a cost budget", () => {
    const constrained = new ConstrainedMDP({
      mdp: config,
      budget: 4,
      costs: {
        Low: { Order: 2, Hold: 0.5 },
        High: { Order: 3, Hold: 1 },
      },
    });

    const goodPolicy = { Low: "Order", High: "Hold" } as const;
    const evaluation = constrained.evaluatePolicy(goodPolicy);
    expect(evaluation.feasible).toBe(true);
    expect(evaluation.rewardValues.Low).toBeGreaterThan(5);
    expect(evaluation.costValues.Low).toBeLessThanOrEqual(4);

    const solvedFromStart = constrained.solve({ start: "Low" });
    expect(solvedFromStart.policy.Low).toBe("Order");
    expect(solvedFromStart.policy.High).toBe("Hold");

    const solvedByAverage = constrained.solve();
    expect(solvedByAverage.feasible).toBe(true);

    const mdp = MDP.from(config);
    const fromInstance = new ConstrainedMDP({
      mdp,
      budget: 10,
      costs: {
        Low: { Order: 2, Hold: 0.5 },
        High: { Order: 3, Hold: 1 },
      },
    });
    expect(fromInstance.solve({ start: "High" }).policy.High).toBe("Hold");
  });

  test("rejects invalid budgets, costs, policy spaces, and infeasible constraints", () => {
    expect(() => new ConstrainedMDP({
      mdp: config,
      budget: -1,
      costs: {
        Low: { Order: 1, Hold: 1 },
        High: { Order: 1, Hold: 1 },
      },
    })).toThrow(/budget/i);

    expect(() => new ConstrainedMDP({
      mdp: config,
      budget: 1,
      costs: {
        Low: { Order: -1, Hold: 1 },
        High: { Order: 1, Hold: 1 },
      },
    })).toThrow(/cost/i);

    expect(() => new ConstrainedMDP({
      mdp: config,
      budget: 1,
      maxPolicies: 0,
      costs: {
        Low: { Order: 1, Hold: 1 },
        High: { Order: 1, Hold: 1 },
      },
    })).toThrow(/maxPolicies/i);

    const tooLarge = new ConstrainedMDP({
      mdp: config,
      budget: 10,
      maxPolicies: 2,
      costs: {
        Low: { Order: 1, Hold: 1 },
        High: { Order: 1, Hold: 1 },
      },
    });
    expect(() => tooLarge.solve()).toThrow(/policy space/i);

    const impossible = new ConstrainedMDP({
      mdp: config,
      budget: 0.1,
      costs: {
        Low: { Order: 2, Hold: 2 },
        High: { Order: 2, Hold: 2 },
      },
    });
    expect(() => impossible.solve()).toThrow(/no feasible/i);
  });
});

describe("MultiObjectiveMDP", () => {
  test("scalarizes multiple objectives and solves through value iteration", () => {
    const mdp = new MultiObjectiveMDP({
      states: config.states,
      actions: config.actions,
      discount: config.discount,
      transition: config.transition,
      objectives: {
        access: {
          Low: { Order: 5, Hold: 1 },
          High: { Order: 0, Hold: 4 },
        },
        cost: {
          Low: { Order: -1, Hold: 0 },
          High: { Order: -4, Hold: -1 },
        },
      },
      weights: { access: 1, cost: 0.25 },
    });

    const solved = mdp.solve();
    expect(solved.policy.Low).toBe("Order");
    expect(solved.policy.High).toBe("Hold");
    expect(mdp.objectives.access.Low.Order).toBe(5);
    expect(mdp.weights.cost).toBe(0.25);
  });

  test("rejects invalid multi-objective inputs", () => {
    expect(() => new MultiObjectiveMDP({
      states: config.states,
      actions: config.actions,
      discount: config.discount,
      transition: config.transition,
      objectives: {},
      weights: {},
    })).toThrow(/objective/i);

    expect(() => new MultiObjectiveMDP({
      states: config.states,
      actions: config.actions,
      discount: config.discount,
      transition: config.transition,
      objectives: {
        access: {
          Low: { Order: 5, Hold: 1 },
          High: { Order: 0, Hold: 4 },
        },
      },
      weights: { access: Number.NaN },
    })).toThrow(/weight/i);

    expect(() => new MultiObjectiveMDP({
      states: config.states,
      actions: config.actions,
      discount: config.discount,
      transition: config.transition,
      objectives: {
        access: {
          Low: { Order: 5, Hold: 1 },
          High: { Order: 0, Hold: 4 },
        },
      },
      weights: { access: 0 },
    })).toThrow(/nonzero/i);

    expect(() => new MultiObjectiveMDP({
      states: config.states,
      actions: config.actions,
      discount: config.discount,
      transition: config.transition,
      objectives: {
        access: {
          Low: { Order: 5, Hold: 1 },
          High: { Order: 0, Hold: Number.NaN },
        },
      },
      weights: { access: 1 },
    })).toThrow(/objective value/i);
  });
});
