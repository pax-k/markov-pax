import { describe, expect, test } from "bun:test";
import { ConstrainedMDP } from "../../index.ts";

describe("theory example: constrained Bellman policy choice", () => {
  test("selects the best finite policy whose discounted cost stays within budget", () => {
    const model = new ConstrainedMDP({
      mdp: {
        states: ["need"],
        actions: ["expensive-fast", "cheap-slow"],
        discount: 0.5,
        transition: {
          need: {
            "expensive-fast": { need: 1 },
            "cheap-slow": { need: 1 },
          },
        },
        reward: {
          need: { "expensive-fast": 5, "cheap-slow": 2 },
        },
      },
      costs: {
        need: { "expensive-fast": 4, "cheap-slow": 1 },
      },
      budget: 3,
    });

    expect(model.solve({ start: "need" }).policy.need).toBe("cheap-slow");
  });
});
