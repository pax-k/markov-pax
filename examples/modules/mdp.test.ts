import { describe, expect, test } from "bun:test";
import { MDP } from "../../index.ts";

describe("module example: MDP", () => {
  test("finds an optimal action policy with value and policy iteration", () => {
    const mdp = MDP.from({
      states: ["Low", "High"],
      actions: ["Invest", "Harvest"],
      discount: 0.9,
      transition: {
        Low: {
          Invest: { Low: 0.25, High: 0.75 },
          Harvest: { Low: 1 },
        },
        High: {
          Invest: { High: 0.8, Low: 0.2 },
          Harvest: { High: 0.4, Low: 0.6 },
        },
      },
      reward: {
        Low: { Invest: 1, Harvest: 0 },
        High: { Invest: 2, Harvest: 6 },
      },
    });

    const valueResult = mdp.valueIteration();
    const policyResult = mdp.policyIteration();
    const simulation = mdp.simulate("Low", valueResult.policy, 3);

    expect(valueResult.policy.Low).toBe("Invest");
    expect(valueResult.policy.High).toBe("Harvest");
    expect(policyResult.policy).toEqual(valueResult.policy);
    expect(simulation).toHaveLength(3);
  });
});
