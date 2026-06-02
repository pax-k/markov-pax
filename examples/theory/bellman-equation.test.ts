import { describe, expect, test } from "bun:test";
import { MDP } from "../../index.ts";

describe("theory example: Bellman optimality", () => {
  test("uses value iteration to solve the Bellman optimality equation", () => {
    const mdp = MDP.from({
      states: ["Empty", "Full"],
      actions: ["Refill", "Wait"],
      discount: 0.9,
      transition: {
        Empty: {
          Refill: { Full: 1 },
          Wait: { Empty: 1 },
        },
        Full: {
          Refill: { Full: 1 },
          Wait: { Empty: 0.4, Full: 0.6 },
        },
      },
      reward: {
        Empty: { Refill: 1, Wait: -2 },
        Full: { Refill: -1, Wait: 3 },
      },
    });

    // Bellman optimality chooses the best action for each state.
    const result = mdp.valueIteration();

    expect(result.policy.Empty).toBe("Refill");
    expect(result.policy.Full).toBe("Wait");
    expect(result.values.Full).toBeGreaterThan(result.values.Empty);
  });
});
