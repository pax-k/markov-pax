import { describe, expect, test } from "bun:test";
import { workflows } from "../../index.ts";

describe("module example: emergency department capacity workflow", () => {
  test("turns acuity queues and candidate actions into an explainable capacity plan", () => {
    const result = workflows.emergencyDepartmentCapacity({
      acuityClasses: ["critical", "standard"],
      priorityOrder: ["critical", "standard"],
      arrivalRates: { critical: 0.4, standard: 1.4 },
      serviceRates: { critical: 2, standard: 2 },
      candidateActions: [
        { action: "hold", servers: 1, capacity: 3 },
        { action: "open-overflow", servers: 2, capacity: 5, fixedCost: 6 },
      ],
      waitingCosts: { critical: 80, standard: 10 },
      rejectionCosts: { critical: 300, standard: 30 },
      serverCost: 1,
      capacityCost: 0.4,
    }).plan({
      surgeMultiplier: 2,
      currentQueueCounts: { critical: 2, standard: 6 },
    });

    expect(result.recommendedAction).toBe("open-overflow");
    expect(result.details.waitingTimeByAcuity).toBeDefined();
    expect(result.details.blockingProbability).toBeDefined();
  });
});
