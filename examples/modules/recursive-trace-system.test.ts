import { describe, expect, test } from "bun:test";
import { SeededRng, createPolicyOverWindows, simulateWindowPolicy, tracePolicy } from "../../index.ts";

describe("module example: recursive trace systems", () => {
  test("models a policy as a Markov chain over observer-window names", () => {
    const policy = createPolicyOverWindows(["small", "large", "hidden"], {
      small: { hidden: 1 },
      hidden: { large: 1 },
      large: { small: 1 },
    });

    const visiblePolicy = tracePolicy(policy, ["small", "large"]);

    expect(simulateWindowPolicy(policy, "small", 2, { rng: new SeededRng(1) })).toEqual(["small", "hidden", "large"]);
    expect(visiblePolicy.chain.transitionProbability("small", "large")).toBe(1);
  });
});
