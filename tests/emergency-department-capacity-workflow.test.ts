import { describe, expect, test } from "bun:test";
import {
  emergencyDepartmentCapacityWorkflow,
  workflows,
} from "../index.ts";

function expectDistribution(distribution: Record<string, number>, tolerance = 1e-8) {
  const total = Object.values(distribution).reduce((sum, value) => sum + value, 0);
  expect(Math.abs(total - 1)).toBeLessThanOrEqual(tolerance);
}

const edConfig = {
  acuityClasses: ["Critical", "Urgent", "Standard"] as const,
  priorityOrder: ["Critical", "Urgent", "Standard"] as const,
  arrivalRates: { Critical: 0.3, Urgent: 0.8, Standard: 1.2 },
  serviceRates: { Critical: 2.2, Urgent: 2, Standard: 1.8 },
  candidateActions: [
    { action: "HoldPlan", servers: 2, capacity: 5, fixedCost: 0 },
    { action: "ReassignStaff", servers: 3, capacity: 5, fixedCost: 8 },
    { action: "OpenOverflowBeds", servers: 3, capacity: 8, fixedCost: 14 },
  ] as const,
  waitingCosts: { Critical: 80, Urgent: 25, Standard: 5 },
  rejectionCosts: { Critical: 300, Urgent: 80, Standard: 10 },
  serverCost: 1,
  capacityCost: 0.4,
};

describe("emergencyDepartmentCapacityWorkflow", () => {
  test("recommends extra capacity under high-acuity surge with inference, forecast, and uncertainty", () => {
    const result = workflows.emergencyDepartmentCapacity({
      ...edConfig,
      pressureInference: {
        model: {
          states: ["Normal", "Crowded", "Surge"],
          actions: ["Observe"],
          observations: ["calm", "crowded"],
          transition: {
            Normal: { Observe: { Normal: 0.8, Crowded: 0.15, Surge: 0.05 } },
            Crowded: { Observe: { Normal: 0.15, Crowded: 0.65, Surge: 0.2 } },
            Surge: { Observe: { Normal: 0.05, Crowded: 0.25, Surge: 0.7 } },
          },
          observation: {
            Normal: { Observe: { calm: 0.9, crowded: 0.1 } },
            Crowded: { Observe: { calm: 0.25, crowded: 0.75 } },
            Surge: { Observe: { calm: 0.1, crowded: 0.9 } },
          },
        },
        belief: { Normal: 0.6, Crowded: 0.3, Surge: 0.1 },
        action: "Observe",
      },
      forecast: {
        transitions: {
          Normal: { Normal: 0.7, Crowded: 0.25, Surge: 0.05 },
          Crowded: { Normal: 0.2, Crowded: 0.55, Surge: 0.25 },
          Surge: { Crowded: 0.45, Surge: 0.55 },
        },
        distribution: { Crowded: 1 },
        steps: 2,
      },
      uncertainty: {
        parameter: "ambulanceSurgeRate",
        initial: 1.2,
        logTarget: (value) => value > 0 ? -((value - 2) ** 2) / 0.5 : Number.NEGATIVE_INFINITY,
        iterations: 50,
        burnIn: 5,
        seed: 12,
      },
    }).plan({
      pressureObservation: "crowded",
      surgeMultiplier: 2,
      bedOccupancy: { occupied: 7, capacity: 8 },
      currentQueueCounts: { Critical: 3, Urgent: 5, Standard: 8 },
    });

    expect(["OpenOverflowBeds", "ReassignStaff"]).toContain(result.recommendedAction!);
    expect(result.recommendedAction).toBe("OpenOverflowBeds");
    expectDistribution(result.belief!);
    expectDistribution(result.forecast as Record<string, number>);
    expect(result.uncertainty!.ambulanceSurgeRate!.samples).toHaveLength(45);
    expect(result.details.queueMetricsByAction).toBeDefined();
    expect(result.details.bestPlan).toBeDefined();
    expect((result.details.waitingTimeByAcuity as Record<string, number>).Critical).toBeLessThan(
      (result.details.waitingTimeByAcuity as Record<string, number>).Standard!,
    );
    expect((result.details.queueLengthByAcuity as Record<string, number>).Standard).toBeGreaterThanOrEqual(0);
    expect((result.details.blockingProbability as Record<string, number>).Critical).toBeGreaterThanOrEqual(0);
    expect(result.details.serverUtilization).toBeGreaterThan(0);
    expect(result.details.bedOccupancy).toEqual({ occupied: 7, capacity: 8, occupancyRate: 7 / 8 });
  });

  test("uses optimizer-only mode and recommends holding plan under low pressure", () => {
    const result = emergencyDepartmentCapacityWorkflow(edConfig).plan({
      currentQueueCounts: { Critical: 0, Urgent: 1, Standard: 2 },
    });

    expect(result.recommendedAction).toBe("HoldPlan");
    expect((result.forecast as Record<string, unknown>).waitingTimeByAcuity).toBeDefined();
    expect(result.details.bedOccupancy).toEqual({ occupied: 3, capacity: 5, occupancyRate: 3 / 5 });
    expect((result.details.currentQueueCounts as Record<string, number>).Critical).toBe(0);
  });

  test("rejects invalid ED workflow configurations and inputs", () => {
    expect(() => workflows.emergencyDepartmentCapacity({
      ...edConfig,
      candidateActions: [],
    })).toThrow(/candidate/i);

    expect(() => emergencyDepartmentCapacityWorkflow({
      ...edConfig,
      acuityClasses: [],
    }).plan()).toThrow(/at least one class/i);

    expect(() => emergencyDepartmentCapacityWorkflow({
      ...edConfig,
      priorityOrder: ["Critical", "Unknown" as "Urgent", "Standard"],
    }).plan()).toThrow(/unknown priority/i);

    expect(() => emergencyDepartmentCapacityWorkflow({
      ...edConfig,
      arrivalRates: { Critical: -1, Urgent: 1, Standard: 1 },
    }).plan()).toThrow(/arrival rate/i);

    expect(() => emergencyDepartmentCapacityWorkflow({
      ...edConfig,
      candidateActions: [{ action: "Bad", servers: 2, capacity: 1 }],
    }).plan()).toThrow(/capacity/i);

    expect(() => emergencyDepartmentCapacityWorkflow(edConfig).plan({
      currentQueueCounts: { Critical: -1 },
    })).toThrow(/currentQueueCounts/i);

    expect(() => emergencyDepartmentCapacityWorkflow(edConfig).plan({
      bedOccupancy: { occupied: 1, capacity: 0 },
    })).toThrow(/bedOccupancy.capacity/i);

    expect(() => emergencyDepartmentCapacityWorkflow(edConfig).plan({
      bedOccupancy: { occupied: -1, capacity: 5 },
    })).toThrow(/bedOccupancy.occupied/i);
  });
});
