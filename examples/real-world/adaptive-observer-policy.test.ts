import { describe, expect, test } from "bun:test";
import { RecursiveTraceSystem, SeededRng, createPolicyOverWindows, tracePolicy } from "../../index.ts";

describe("real-world example: adaptive observer policy", () => {
  test("models switching between coarse and detailed monitoring windows", () => {
    const monitoringPolicy = createPolicyOverWindows(["coarse", "diagnostic", "hiddenCalibration"], {
      coarse: { hiddenCalibration: 1 },
      hiddenCalibration: { diagnostic: 1 },
      diagnostic: { coarse: 1 },
    });
    const system = new RecursiveTraceSystem({ monitoring: monitoringPolicy });
    const visiblePolicy = tracePolicy(monitoringPolicy, ["coarse", "diagnostic"]);

    expect(system.simulateLevel("monitoring", "coarse", 2, { rng: new SeededRng(3) })).toEqual([
      "coarse",
      "hiddenCalibration",
      "diagnostic",
    ]);
    expect(visiblePolicy.chain.transitionProbability("coarse", "diagnostic")).toBe(1);
  });
});
