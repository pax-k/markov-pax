import { describe, expect, test } from "bun:test";
import { ConstrainedMDP, MultiObjectiveMDP } from "../../index.ts";

describe("module example: constrained and multi-objective MDPs", () => {
  test("chooses actions under a budget and scalarizes competing objectives", () => {
    const transition = {
      disrupted: {
        rebuild: { stable: 1 },
        ration: { disrupted: 1 },
      },
      stable: {
        rebuild: { stable: 1 },
        ration: { stable: 1 },
      },
    };

    const constrained = new ConstrainedMDP({
      mdp: {
        states: ["disrupted", "stable"],
        actions: ["rebuild", "ration"],
        discount: 0.5,
        transition,
        reward: {
          disrupted: { rebuild: 10, ration: 3 },
          stable: { rebuild: 0, ration: 5 },
        },
      },
      costs: {
        disrupted: { rebuild: 8, ration: 1 },
        stable: { rebuild: 8, ration: 1 },
      },
      budget: 10,
    });

    const multiObjective = new MultiObjectiveMDP({
      states: ["disrupted", "stable"],
      actions: ["rebuild", "ration"],
      discount: 0.5,
      transition,
      objectives: {
        access: {
          disrupted: { rebuild: 10, ration: 4 },
          stable: { rebuild: 0, ration: 5 },
        },
        cost: {
          disrupted: { rebuild: -8, ration: -1 },
          stable: { rebuild: -8, ration: -1 },
        },
      },
      weights: { access: 1, cost: 0.2 },
    });

    expect(constrained.solve({ start: "disrupted" }).policy.disrupted).toBe("rebuild");
    expect(multiObjective.solve().policy.disrupted).toBe("rebuild");
  });
});
