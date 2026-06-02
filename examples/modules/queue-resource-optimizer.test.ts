import { describe, expect, test } from "bun:test";
import { QueueResourceOptimizer } from "../../index.ts";

describe("module example: queue resource optimizer", () => {
  test("chooses a capacity action by evaluating explainable queue costs", () => {
    const optimizer = new QueueResourceOptimizer({
      classes: ["urgent", "standard"],
      priorityOrder: ["urgent", "standard"],
      arrivalRates: { urgent: 0.6, standard: 1.2 },
      serviceRates: { urgent: 2.5, standard: 2.5 },
      candidates: [
        { action: "hold", servers: 1, capacity: 3 },
        { action: "add-server", servers: 2, capacity: 4, fixedCost: 5 },
      ],
      waitingCosts: { urgent: 40, standard: 8 },
      rejectionCosts: { urgent: 200, standard: 20 },
      serverCost: 1,
      capacityCost: 0.5,
    });

    const surgePlan = optimizer.evaluate({ arrivalRateScale: 2.5 });

    expect(surgePlan.recommendedAction).toBe("add-server");
    expect(surgePlan.best.costs.totalCost).toBeGreaterThan(0);
    expect(surgePlan.best.metrics.blockingProbabilityByClass.urgent).toBeLessThan(1);
  });

  test("uses custom business scoring without changing queueing math", () => {
    const optimizer = new QueueResourceOptimizer({
      classes: ["urgent", "standard"],
      priorityOrder: ["urgent", "standard"],
      arrivalRates: { urgent: 0.6, standard: 1.2 },
      serviceRates: { urgent: 2.5, standard: 2.5 },
      candidates: [
        { action: "hold", servers: 1, capacity: 3 },
        { action: "add-server", servers: 2, capacity: 4, fixedCost: 5, metadata: { overnight: true } },
      ],
      waitingCosts: { urgent: 40, standard: 8 },
      rejectionCosts: { urgent: 200, standard: 20 },
      serverCost: 1,
      capacityCost: 0.5,
      actionValue: (costs, { candidate }) => -costs.totalCost - (candidate.metadata?.overnight ? 2 : 0),
    });

    const plan = optimizer.evaluate({ arrivalRateScale: 2.5 });

    expect(plan.recommendedAction).toBe("add-server");
    expect(plan.best.candidate.metadata?.overnight).toBe(true);
    expect(plan.actionValues["add-server"]).toBeGreaterThan(plan.actionValues.hold);
  });
});
