import { describe, expect, test } from "bun:test";
import { QueueResourceOptimizer } from "../index.ts";

const optimizerConfig = {
  classes: ["Critical", "Stable"] as const,
  priorityOrder: ["Critical", "Stable"] as const,
  arrivalRates: { Critical: 0.4, Stable: 0.8 },
  serviceRates: { Critical: 2, Stable: 2 },
  candidates: [
    { action: "HoldPlan", servers: 1, capacity: 3, fixedCost: 0 },
    { action: "OpenOverflowBeds", servers: 3, capacity: 6, fixedCost: 15 },
  ] as const,
  waitingCosts: { Critical: 50, Stable: 5 },
  rejectionCosts: { Critical: 200, Stable: 20 },
  serverCost: 0.5,
  capacityCost: 0.2,
};

describe("QueueResourceOptimizer", () => {
  test("recommends baseline capacity under low load and extra capacity under surge", () => {
    const optimizer = new QueueResourceOptimizer(optimizerConfig);
    const lowLoad = optimizer.evaluate();
    const surge = optimizer.evaluate({ arrivalRateScale: 4 });

    expect(lowLoad.recommendedAction).toBe("HoldPlan");
    expect(surge.recommendedAction).toBe("OpenOverflowBeds");
    expect(lowLoad.actionValues.HoldPlan).toBeGreaterThan(lowLoad.actionValues.OpenOverflowBeds);
    expect(surge.actionValues.OpenOverflowBeds).toBeGreaterThan(surge.actionValues.HoldPlan);
    expect(surge.best.costs.rejectionCostByClass!.Critical).toBeGreaterThan(surge.best.costs.rejectionCostByClass!.Stable);
    expect(surge.best.costs.waitingCostByClass!.Critical).toBeGreaterThanOrEqual(0);
    expect(surge.evaluations.OpenOverflowBeds.metrics.utilization).toBeGreaterThan(0);
    expect(surge.best.candidate.capacity).toBe(6);
  });

  test("supports custom cost functions, action values, and candidate metadata", () => {
    const optimizer = new QueueResourceOptimizer({
      ...optimizerConfig,
      candidates: [
        { action: "HoldPlan", servers: 1, capacity: 3, metadata: { playbook: "baseline" } },
        { action: "OpenOverflowBeds", servers: 3, capacity: 6, fixedCost: 15, metadata: { playbook: "overflow" } },
      ],
      costFunction: ({ candidate, defaultCosts }) => ({
        ...defaultCosts,
        totalCost: defaultCosts.totalCost + (candidate.metadata?.playbook === "overflow" ? 10_000 : 0),
      }),
    });

    const plan = optimizer.evaluate({ arrivalRateScale: 4 });
    expect(plan.recommendedAction).toBe("HoldPlan");
    expect(plan.evaluations.OpenOverflowBeds.candidate.metadata?.playbook).toBe("overflow");
    expect(plan.actionValues.HoldPlan).toBeGreaterThan(plan.actionValues.OpenOverflowBeds);

    const valueBased = new QueueResourceOptimizer({
      ...optimizerConfig,
      candidates: [
        { action: "HoldPlan", servers: 1, capacity: 3 },
        { action: "OpenOverflowBeds", servers: 3, capacity: 6, fixedCost: 15 },
      ],
      costFunction: ({ candidate, defaultCosts }) => ({
        totalCost: defaultCosts.totalCost,
        fixedCost: candidate.fixedCost ?? 0,
      }),
      actionValue: (_costs, { candidate }) => candidate.action === "OpenOverflowBeds" ? 1 : 0,
    }).evaluate();

    expect(valueBased.recommendedAction).toBe("OpenOverflowBeds");
    expect(valueBased.best.costs.fixedCost).toBe(15);
  });

  test("passes generic queue service and admission policies into candidate evaluation", () => {
    const optimizer = new QueueResourceOptimizer({
      ...optimizerConfig,
      serviceDiscipline: "proportional",
      admissionPolicy: { kind: "priority-reserve", reserves: { Critical: 1 } },
      candidates: [
        { action: "HoldPlan", servers: 1, capacity: 2 },
      ],
    });

    const plan = optimizer.evaluate();
    expect(plan.recommendedAction).toBe("HoldPlan");
    expect(plan.best.metrics.blockingProbabilityByClass.Stable)
      .toBeGreaterThan(plan.best.metrics.blockingProbabilityByClass.Critical);
    expect(plan.best.metrics.utilization).toBeGreaterThan(0);
  });

  test("rejects invalid optimizer inputs and candidate modifiers", () => {
    expect(() => new QueueResourceOptimizer({
      ...optimizerConfig,
      candidates: [],
    })).toThrow(/candidate/i);

    expect(() => new QueueResourceOptimizer({
      ...optimizerConfig,
      waitingCosts: { Critical: -1, Stable: 1 },
    })).toThrow(/waiting cost/i);

    expect(() => new QueueResourceOptimizer({
      ...optimizerConfig,
      rejectionCosts: { Critical: 1, Stable: -1 },
    })).toThrow(/rejection cost/i);

    expect(() => new QueueResourceOptimizer({
      ...optimizerConfig,
      serverCost: -1,
    })).toThrow(/serverCost/i);

    expect(() => new QueueResourceOptimizer({
      ...optimizerConfig,
      capacityCost: -1,
    })).toThrow(/capacityCost/i);

    expect(() => new QueueResourceOptimizer(optimizerConfig).evaluate({ arrivalRateScale: -1 })).toThrow(/arrivalRateScale/i);

    expect(() => new QueueResourceOptimizer({
      ...optimizerConfig,
      candidates: [{ action: "Bad", servers: 1, capacity: 2, arrivalRateScale: -1 }],
    }).evaluate()).toThrow(/candidate arrivalRateScale/i);

    expect(() => new QueueResourceOptimizer({
      ...optimizerConfig,
      candidates: [{ action: "Bad", servers: 1, capacity: 2, serviceRateScale: 0 }],
    }).evaluate()).toThrow(/serviceRateScale/i);

    expect(() => new QueueResourceOptimizer({
      ...optimizerConfig,
      candidates: [{ action: "Bad", servers: 1, capacity: 2, fixedCost: -1 }],
    }).evaluate()).toThrow(/fixedCost/i);

    expect(() => new QueueResourceOptimizer({
      ...optimizerConfig,
      candidates: [{ action: "Bad", servers: 2, capacity: 1 }],
    }).evaluate()).toThrow(/capacity/i);

    expect(() => new QueueResourceOptimizer({
      ...optimizerConfig,
      costFunction: () => ({ totalCost: Number.POSITIVE_INFINITY }),
    }).evaluate()).toThrow(/finite totalCost/i);

    expect(() => new QueueResourceOptimizer({
      ...optimizerConfig,
      actionValue: () => Number.NaN,
    }).evaluate()).toThrow(/finite number/i);
  });
});
