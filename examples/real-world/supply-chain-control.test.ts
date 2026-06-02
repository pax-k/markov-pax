import { describe, expect, test } from "bun:test";
import {
  BirthDeathProcess,
  CTMC,
  MDP,
  MM1Queue,
  POMDP,
  RenewalProcess,
  deterministicHoldingTime,
} from "../../index.ts";

function sum(values: Iterable<number>) {
  return Array.from(values).reduce((total, value) => total + value, 0);
}

describe("real-world example: supply chain control", () => {
  test("connects demand renewal, supplier reliability, noisy stock belief, queue pressure, and reorder policy", () => {
    const demand = new RenewalProcess(deterministicHoldingTime(2));
    const supplier = CTMC.fromGenerator({
      Reliable: { Reliable: -0.05, Delayed: 0.05 },
      Delayed: { Reliable: 0.25, Delayed: -0.25 },
    });

    const beliefModel = POMDP.from({
      states: ["Low", "Healthy"],
      actions: ["Count"],
      observations: ["empty-bin", "stock-seen"],
      transition: {
        Low: { Count: { Low: 0.85, Healthy: 0.15 } },
        Healthy: { Count: { Low: 0.25, Healthy: 0.75 } },
      },
      observation: {
        Low: { Count: { "empty-bin": 0.8, "stock-seen": 0.2 } },
        Healthy: { Count: { "empty-bin": 0.1, "stock-seen": 0.9 } },
      },
    });

    const inventory = MDP.from({
      states: ["Low", "Healthy", "Overstock"],
      actions: ["Order", "Hold", "Discount"],
      discount: 0.9,
      transition: {
        Low: {
          Order: { Low: 0.25, Healthy: 0.75 },
          Hold: { Low: 0.9, Healthy: 0.1 },
          Discount: { Low: 1 },
        },
        Healthy: {
          Order: { Healthy: 0.45, Overstock: 0.55 },
          Hold: { Low: 0.2, Healthy: 0.7, Overstock: 0.1 },
          Discount: { Low: 0.35, Healthy: 0.55, Overstock: 0.1 },
        },
        Overstock: {
          Order: { Overstock: 0.9, Healthy: 0.1 },
          Hold: { Overstock: 0.65, Healthy: 0.35 },
          Discount: { Overstock: 0.2, Healthy: 0.8 },
        },
      },
      reward: {
        Low: { Order: 4, Hold: -5, Discount: -6 },
        Healthy: { Order: 0, Hold: 5, Discount: 1 },
        Overstock: { Order: -5, Hold: 0, Discount: 4 },
      },
    });

    const stagingQueue = new MM1Queue({ arrivalRate: 12, serviceRate: 18 });
    const finiteBacklog = new BirthDeathProcess({ birthRate: () => 2, deathRate: (state) => state });

    const demandCount = demand.countBy(14);
    const supplierAvailability = supplier.stationary();
    const belief = beliefModel.updateBelief({ belief: { Low: 0.4, Healthy: 0.6 }, action: "Count", observation: "empty-bin" });
    const policy = inventory.valueIteration().policy;
    const backlog = finiteBacklog.stationaryDistribution(4);

    expect(demandCount).toBe(7);
    expect(supplierAvailability.Reliable).toBeGreaterThan(0.75);
    expect(sum(Object.values(belief))).toBeCloseTo(1);
    expect(belief.Low).toBeGreaterThan(belief.Healthy);
    expect(policy.Low).toBe("Order");
    expect(stagingQueue.expectedNumberInQueue()).toBeGreaterThan(0);
    expect(sum(Object.values(backlog))).toBeCloseTo(1);
  });
});
