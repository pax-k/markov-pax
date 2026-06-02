import { describe, expect, test } from "bun:test";
import { exponentialHoldingTime, workflows } from "../../index.ts";

describe("real-world example: high-level inventory-control workflow", () => {
  test("updates stock belief, chooses reorder action, and reports operational pressure", () => {
    const result = workflows.inventoryControl({
      stockBelief: {
        states: ["Enough", "Short"],
        actions: ["Inspect"],
        observations: ["on-time", "late"],
        transition: {
          Enough: { Inspect: { Enough: 0.72, Short: 0.28 } },
          Short: { Inspect: { Enough: 0.22, Short: 0.78 } },
        },
        observation: {
          Enough: { Inspect: { "on-time": 0.82, late: 0.18 } },
          Short: { Inspect: { "on-time": 0.12, late: 0.88 } },
        },
      },
      policy: {
        states: ["Enough", "Short"],
        actions: ["Reorder", "Hold"],
        discount: 0.86,
        transition: {
          Enough: {
            Reorder: { Enough: 0.92, Short: 0.08 },
            Hold: { Enough: 0.68, Short: 0.32 },
          },
          Short: {
            Reorder: { Enough: 0.82, Short: 0.18 },
            Hold: { Enough: 0.18, Short: 0.82 },
          },
        },
        reward: {
          Enough: { Reorder: 1, Hold: 3 },
          Short: { Reorder: 2, Hold: -5 },
        },
      },
      policyState: "Short",
      supplier: {
        Available: { Available: -0.06, Delayed: 0.06 },
        Delayed: { Available: 0.28, Delayed: -0.28 },
      },
      supplierState: "Available",
      supplierTime: 3,
      demand: { waitingTime: exponentialHoldingTime(1.2), horizon: 4, seed: 23 },
      queue: { arrivalRate: 3, serviceRate: 7 },
      backlog: {
        birthRate: () => 1.4,
        deathRate: () => 2.5,
        maxState: 4,
      },
    }).plan({
      belief: { Enough: 0.55, Short: 0.45 },
      action: "Inspect",
      observation: "late",
    });

    expect(result.inferredState).toBe("Short");
    expect(result.recommendedAction).toBe("Reorder");
    expect(result.details.supplierAvailability).toBeDefined();
    expect(result.details.demandCount).toBeGreaterThanOrEqual(0);
    expect(result.details.queuePressure).toBeDefined();
    expect(result.details.backlogDistribution).toBeDefined();
  });
});
