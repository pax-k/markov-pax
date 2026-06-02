import { describe, expect, test } from "bun:test";
import {
  PolicyOverWindows,
  RecursiveTraceSystem,
  SeededRng,
  createPolicyOverWindows,
  simulateWindowPolicy,
  tracePolicy,
} from "../index.ts";

describe("recursive trace systems and policies over windows", () => {
  test("simulates policies over observer-window names and traces policy windows", () => {
    const policy = createPolicyOverWindows(["small", "large", "hidden"], {
      small: { hidden: 1 },
      hidden: { large: 1 },
      large: { small: 1 },
    });

    expect(policy.windowNames).toEqual(["small", "large", "hidden"]);
    expect(simulateWindowPolicy(policy, "small", 3, { rng: new SeededRng(1) })).toEqual(["small", "hidden", "large", "small"]);

    const traced = tracePolicy(policy, ["small", "large"]);
    expect(traced.windowNames).toEqual(["small", "large"]);
    expect(traced.chain.transitionProbability("small", "large")).toBe(1);
    expect(policy.trace(["small", "large"]).chain.transitionProbability("large", "small")).toBe(1);
  });

  test("uses policy names as states for meta-policies", () => {
    const metaPolicy = new PolicyOverWindows({
      windowNames: ["embodied", "nonEmbodied"],
      transitions: {
        embodied: { embodied: 0.8, nonEmbodied: 0.2 },
        nonEmbodied: { embodied: 0.5, nonEmbodied: 0.5 },
      },
    });
    const system = new RecursiveTraceSystem({
      meta: metaPolicy,
    });

    const path = system.simulateLevel("meta", "embodied", 2, { rng: new SeededRng(4) });
    expect(path[0]).toBe("embodied");
    expect(path).toHaveLength(3);
  });

  test("rejects invalid recursive policy definitions and lookups", () => {
    expect(() => new PolicyOverWindows({
      windowNames: ["a", "b"],
      transitions: {
        a: { a: 1 },
      } as never,
    })).toThrow(/must match/i);

    expect(() => new RecursiveTraceSystem({})).toThrow(/at least one/i);

    const system = new RecursiveTraceSystem({
      level0: createPolicyOverWindows(["a"], { a: { a: 1 } }),
    });
    expect(() => system.simulateLevel("missing" as "level0", "a", 1)).toThrow(/Unknown recursive/i);
  });
});
