import { describe, expect, test } from "bun:test";
import {
  BirthDeathProcess,
  FiniteCapacityQueue,
  MM1Queue,
  MMcKQueue,
  MMcQueue,
  MultiClassFiniteQueue,
  PriorityQueueModel,
} from "../../index.ts";

function sum(values: Iterable<number>) {
  return Array.from(values).reduce((total, value) => total + value, 0);
}

describe("module example: queues", () => {
  test("computes M/M/1, M/M/c, finite-capacity, and priority queue metrics", () => {
    const queue = new MM1Queue({ arrivalRate: 4, serviceRate: 10 });

    expect(queue.rho()).toBeCloseTo(0.4);
    expect(queue.expectedNumberInSystem()).toBeCloseTo(2 / 3);
    expect(queue.expectedTimeInSystem()).toBeCloseTo(1 / 6);

    const triageServers = new MMcQueue({ arrivalRate: 6, serviceRate: 4, servers: 2 });
    expect(triageServers.probabilityOfWait()).toBeGreaterThan(0);

    const birthDeath = new BirthDeathProcess({
      birthRate: () => 4,
      deathRate: (state) => (state === 0 ? 0 : 10),
    });
    const distribution = birthDeath.stationaryDistribution(4);

    expect(sum(Object.values(distribution))).toBeCloseTo(1);
    expect(distribution[0]).toBeGreaterThan(distribution[4]!);

    const finite = new FiniteCapacityQueue({
      capacity: 4,
      birthRate: () => 6,
      deathRate: (state) => Math.min(state, 2) * 4,
    });
    expect(finite.blockingProbability()).toBeGreaterThan(0);

    const beds = new MMcKQueue({ arrivalRate: 6, serviceRate: 4, servers: 2, capacity: 5 });
    expect(beds.effectiveArrivalRate()).toBeLessThan(6);

    const priority = PriorityQueueModel.from({
      classes: ["critical", "standard"],
      priorityOrder: ["critical", "standard"],
      arrivalRates: { critical: 1, standard: 3 },
      serviceRates: { critical: 5, standard: 5 },
      servers: 2,
      capacity: 5,
    });
    expect(priority.waitingTimesByClass().critical).toBeLessThan(priority.waitingTimesByClass().standard);
  });

  test("customizes finite multi-class queues with service and admission policies", () => {
    const proportionalSupport = new MultiClassFiniteQueue({
      classes: ["enterprise", "selfServe"],
      arrivalRates: { enterprise: 1, selfServe: 4 },
      serviceRates: { enterprise: 3, selfServe: 3 },
      servers: 2,
      capacity: 5,
      serviceDiscipline: "proportional",
    });

    const busyAllocation = proportionalSupport.serviceAllocation({ enterprise: 1, selfServe: 3 });
    expect(busyAllocation.enterprise).toBeCloseTo(0.5);
    expect(busyAllocation.selfServe).toBeCloseTo(1.5);

    const reservedEmergencySlot = new MultiClassFiniteQueue({
      classes: ["critical", "routine"],
      priorityOrder: ["critical", "routine"],
      arrivalRates: { critical: 1, routine: 5 },
      serviceRates: { critical: 4, routine: 4 },
      servers: 1,
      capacity: 2,
      admissionPolicy: { kind: "priority-reserve", reserves: { critical: 1 } },
    });

    expect(reservedEmergencySlot.admittedArrivalRates({ critical: 0, routine: 1 }).routine).toBe(0);
    expect(reservedEmergencySlot.blockingProbabilityByClass().routine)
      .toBeGreaterThan(reservedEmergencySlot.blockingProbabilityByClass().critical);
  });
});
