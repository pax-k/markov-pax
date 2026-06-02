import { describe, expect, test } from "bun:test";
import {
  NonHomogeneousPoissonProcess,
  workflows,
} from "../../index.ts";

describe("real-world example: emergency department capacity planning", () => {
  test("models crowding, acuity-priority queues, beds, servers, and action recommendation", () => {
    const ambulanceArrivals = new NonHomogeneousPoissonProcess([
      { start: 0, end: 4, rate: 1.5 },
      { start: 4, end: 8, rate: 4.5 },
    ]);
    const baselineExpected = 8 * 1.5;
    const surgeMultiplier = ambulanceArrivals.expectedCount(8) / baselineExpected;

    const result = workflows.emergencyDepartmentCapacity({
      acuityClasses: ["critical", "urgent", "standard"],
      priorityOrder: ["critical", "urgent", "standard"],
      arrivalRates: { critical: 0.25, urgent: 0.7, standard: 1.1 },
      serviceRates: { critical: 2.1, urgent: 1.9, standard: 1.7 },
      candidateActions: [
        { action: "HoldPlan", servers: 2, capacity: 5 },
        { action: "ReassignStaff", servers: 3, capacity: 5, fixedCost: 8 },
        { action: "OpenOverflowBeds", servers: 3, capacity: 8, fixedCost: 14 },
      ],
      waitingCosts: { critical: 90, urgent: 30, standard: 6 },
      rejectionCosts: { critical: 350, urgent: 100, standard: 15 },
      serverCost: 1,
      capacityCost: 0.4,
    }).plan({
      surgeMultiplier,
      bedOccupancy: { occupied: 7, capacity: 8 },
      currentQueueCounts: { critical: 3, urgent: 6, standard: 10 },
    });

    expect(result.recommendedAction).toBe("OpenOverflowBeds");
    expect(result.details.serverUtilization).toBeGreaterThan(0);
    expect((result.details.blockingProbability as Record<string, number>).critical).toBeGreaterThanOrEqual(0);
  });
});
