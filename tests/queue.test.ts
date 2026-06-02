import { describe, expect, test } from "bun:test";
import {
  BirthDeathProcess,
  FiniteCapacityQueue,
  MM1Queue,
  MMcKQueue,
  MMcQueue,
  MultiClassFiniteQueue,
  PriorityQueueModel,
} from "../index.ts";

function expectClose(actual: number, expected: number, tolerance = 1e-8) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

function sum(values: Iterable<number>) {
  return Array.from(values).reduce((total, value) => total + value, 0);
}

describe("MM1Queue", () => {
  test("computes stationary probabilities and queueing metrics", () => {
    const queue = new MM1Queue({ arrivalRate: 2, serviceRate: 5 });
    expectClose(queue.rho(), 0.4);
    expectClose(queue.stationaryProbability(0), 0.6);
    expectClose(queue.stationaryProbability(3), 0.6 * 0.4 ** 3);
    expectClose(queue.expectedNumberInSystem(), 2 / 3);
    expectClose(queue.expectedNumberInQueue(), 0.2666666667, 1e-8);
    expectClose(queue.expectedTimeInSystem(), 1 / 3);
    expectClose(queue.expectedTimeInQueue(), 0.4 / 3);
  });

  test("rejects unstable queues and invalid rates/states", () => {
    expect(() => new MM1Queue({ arrivalRate: 5, serviceRate: 5 })).toThrow(/unstable/i);
    expect(() => new MM1Queue({ arrivalRate: -1, serviceRate: 5 })).toThrow(/arrivalRate/i);
    expect(() => new MM1Queue({ arrivalRate: 1, serviceRate: 0 })).toThrow(/serviceRate/i);
    expect(() => new MM1Queue({ arrivalRate: 1, serviceRate: 5 }).stationaryProbability(-1)).toThrow(/state/i);
  });
});

describe("MMcQueue", () => {
  test("matches M/M/1 metrics when servers is one and computes Erlang-C quantities", () => {
    const mm1 = new MM1Queue({ arrivalRate: 2, serviceRate: 5 });
    const mmc = new MMcQueue({ arrivalRate: 2, serviceRate: 5, servers: 1 });

    expectClose(mmc.rho(), mm1.rho());
    expectClose(mmc.utilization(), 0.4);
    expectClose(mmc.idleProbability(), 0.6);
    expectClose(mmc.erlangC(), 0.4);
    expectClose(mmc.probabilityOfWait(), 0.4);
    expectClose(mmc.stationaryProbability(3), mm1.stationaryProbability(3));
    expectClose(mmc.expectedNumberInQueue(), mm1.expectedNumberInQueue());
    expectClose(mmc.expectedNumberInSystem(), mm1.expectedNumberInSystem());
    expectClose(mmc.expectedTimeInQueue(), mm1.expectedTimeInQueue());
    expectClose(mmc.expectedTimeInSystem(), mm1.expectedTimeInSystem());

    const twoServer = new MMcQueue({ arrivalRate: 3, serviceRate: 2, servers: 2 });
    expect(twoServer.stationaryProbability(1)).toBeGreaterThan(0);
    expect(twoServer.stationaryProbability(3)).toBeGreaterThan(0);

    const idle = new MMcQueue({ arrivalRate: 0, serviceRate: 2, servers: 2 });
    expectClose(idle.expectedTimeInQueue(), 0);
    expectClose(idle.expectedTimeInSystem(), 0.5);
  });

  test("rejects invalid M/M/c inputs", () => {
    expect(() => new MMcQueue({ arrivalRate: 4, serviceRate: 2, servers: 2 })).toThrow(/unstable/i);
    expect(() => new MMcQueue({ arrivalRate: Number.POSITIVE_INFINITY, serviceRate: 2, servers: 2 })).toThrow(/finite/i);
    expect(() => new MMcQueue({ arrivalRate: 1, serviceRate: 2, servers: 0 })).toThrow(/positive integer/i);
    expect(() => new MMcQueue({ arrivalRate: 1, serviceRate: 0, servers: 1 })).toThrow(/positive/i);
    expect(() => new MMcQueue({ arrivalRate: 1, serviceRate: 2, servers: 1 }).stationaryProbability(-1)).toThrow(/state/i);
  });
});

describe("FiniteCapacityQueue", () => {
  test("computes finite birth-death capacity metrics", () => {
    const queue = new FiniteCapacityQueue({
      capacity: 3,
      birthRate: () => 2,
      deathRate: (state) => state * 5,
    });

    const distribution = queue.stationaryDistribution();
    expectClose(sum(Object.values(distribution)), 1);
    expectClose(queue.stationaryProbability(3), distribution[3]!);
    expectClose(queue.blockingProbability(), distribution[3]!);
    expectClose(queue.effectiveArrivalRate(), 2 * (1 - distribution[3]!));
    expectClose(queue.throughput(), queue.effectiveArrivalRate());
    expect(queue.expectedNumberInSystem()).toBeGreaterThan(0);

    const closed = new FiniteCapacityQueue({
      capacity: 0,
      birthRate: () => 4,
      deathRate: () => 1,
    });
    expectClose(closed.blockingProbability(), 1);
    expectClose(closed.effectiveArrivalRate(), 0);
  });

  test("rejects invalid finite capacity inputs and rates", () => {
    expect(() => new FiniteCapacityQueue({
      capacity: -1,
      birthRate: () => 1,
      deathRate: () => 1,
    })).toThrow(/capacity/i);

    expect(() => new FiniteCapacityQueue({
      capacity: 2,
      birthRate: () => -1,
      deathRate: () => 1,
    }).stationaryDistribution()).toThrow(/birthRate/i);

    expect(() => new FiniteCapacityQueue({
      capacity: 2,
      birthRate: () => 1,
      deathRate: () => 0,
    }).stationaryDistribution()).toThrow(/deathRate/i);

    expect(() => new FiniteCapacityQueue({
      capacity: 2,
      birthRate: () => 1,
      deathRate: () => 1,
    }).stationaryProbability(3)).toThrow(/capacity/i);
  });
});

describe("MMcKQueue", () => {
  test("computes finite multi-server blocking, throughput, and wait metrics", () => {
    const queue = new MMcKQueue({ arrivalRate: 4, serviceRate: 3, servers: 2, capacity: 4 });
    const distribution = queue.stationaryDistribution();

    expectClose(sum(Object.values(distribution)), 1);
    expectClose(queue.stationaryProbability(4), distribution[4]!);
    expectClose(queue.blockingProbability(), distribution[4]!);
    expect(queue.effectiveArrivalRate()).toBeLessThan(4);
    expectClose(queue.throughput(), queue.effectiveArrivalRate());
    expect(queue.utilization()).toBeGreaterThan(0);
    expect(queue.expectedNumberInSystem()).toBeGreaterThan(queue.expectedNumberInQueue());
    expect(queue.expectedTimeInSystem()).toBeGreaterThan(queue.expectedTimeInQueue());

    const noArrivals = new MMcKQueue({ arrivalRate: 0, serviceRate: 3, servers: 1, capacity: 2 });
    expectClose(noArrivals.expectedTimeInSystem(), 0);
    expectClose(noArrivals.expectedTimeInQueue(), 0);
  });

  test("rejects invalid M/M/c/K inputs", () => {
    expect(() => new MMcKQueue({ arrivalRate: 1, serviceRate: 2, servers: 2, capacity: 1 })).toThrow(/capacity/i);
    expect(() => new MMcKQueue({ arrivalRate: -1, serviceRate: 2, servers: 1, capacity: 2 })).toThrow(/arrivalRate/i);
    expect(() => new MMcKQueue({ arrivalRate: 1, serviceRate: -2, servers: 1, capacity: 2 })).toThrow(/serviceRate/i);
  });
});

describe("MultiClassFiniteQueue and PriorityQueueModel", () => {
  test("enumerates finite states and honors priority service allocation", () => {
    const queue = new MultiClassFiniteQueue({
      classes: ["Critical", "Stable"],
      priorityOrder: ["Critical", "Stable"],
      arrivalRates: { Critical: 1.5, Stable: 2.5 },
      serviceRates: { Critical: 4, Stable: 4 },
      servers: 2,
      capacity: 4,
    });

    expect(queue.stateSpace).toHaveLength(15);
    const distribution = queue.stationaryDistribution();
    expectClose(sum(Object.values(distribution)), 1);
    expectClose(sum(Object.values(queue.stationaryDistribution())), 1);
    expect(queue.generatorMatrix()[0]!.reduce((total, value) => total + value, 0)).toBeCloseTo(0);
    expect(queue.stationaryProbability({ Critical: 0, Stable: 0 })).toBeGreaterThan(0);

    const allocation = queue.serviceAllocation({ Critical: 2, Stable: 2 });
    expect(allocation.Critical).toBe(2);
    expect(allocation.Stable).toBe(0);

    const metrics = queue.metrics();
    expect(metrics.waitingTimeInQueueByClass.Critical).toBeLessThan(metrics.waitingTimeInQueueByClass.Stable);
    expect(metrics.queueLengthByClass.Stable).toBeGreaterThanOrEqual(0);
    expect(metrics.timeInSystemByClass.Critical).toBeGreaterThan(0);
    expect(metrics.effectiveArrivalRates.Critical).toBeLessThanOrEqual(1.5);
    expect(metrics.blockingProbabilityByClass.Critical).toBe(metrics.blockingProbabilityByClass.Stable);
    expect(metrics.utilization).toBeGreaterThan(0);

    const priority = PriorityQueueModel.from({
      classes: ["Critical", "Stable"],
      priorityOrder: ["Critical", "Stable"],
      arrivalRates: { Critical: 1, Stable: 2 },
      serviceRates: { Critical: 4, Stable: 4 },
      servers: 2,
      capacity: 3,
    });
    expect(sum(Object.values(priority.stationaryDistribution()))).toBeCloseTo(1);
    expect(priority.metrics().utilization).toBeGreaterThan(0);
    expect(priority.waitingTimesByClass().Critical).toBeLessThan(priority.waitingTimesByClass().Stable);
  });

  test("supports proportional service and class-specific admission policies", () => {
    const proportional = new MultiClassFiniteQueue({
      classes: ["Critical", "Stable"],
      arrivalRates: { Critical: 1, Stable: 3 },
      serviceRates: { Critical: 4, Stable: 4 },
      servers: 2,
      capacity: 4,
      serviceDiscipline: "proportional",
    });

    expect(proportional.priorityOrder).toEqual(["Critical", "Stable"]);
    expect(proportional.serviceAllocation({ Critical: 0, Stable: 0 })).toEqual({ Critical: 0, Stable: 0 });
    const allocation = proportional.serviceAllocation({ Critical: 1, Stable: 3 });
    expectClose(allocation.Critical, 0.5);
    expectClose(allocation.Stable, 1.5);
    expect(proportional.metrics().utilization).toBeGreaterThan(0);

    const reserved = new MultiClassFiniteQueue({
      classes: ["Critical", "Stable"],
      priorityOrder: ["Critical", "Stable"],
      arrivalRates: { Critical: 1, Stable: 5 },
      serviceRates: { Critical: 3, Stable: 3 },
      servers: 1,
      capacity: 2,
      admissionPolicy: { kind: "priority-reserve", reserves: { Critical: 1 } },
    });
    expect(reserved.admittedArrivalRates({ Critical: 0, Stable: 1 })).toEqual({ Critical: 1, Stable: 0 });
    expect(reserved.admittedArrivalRates({ Critical: 1, Stable: 1 })).toEqual({ Critical: 0, Stable: 0 });
    const blocking = reserved.blockingProbabilityByClass();
    expect(blocking.Stable).toBeGreaterThan(blocking.Critical);
    expect(reserved.effectiveArrivalRates().Stable).toBeLessThan(5);
  });

  test("supports custom service and admission policies with validation", () => {
    const custom = new MultiClassFiniteQueue({
      classes: ["Critical", "Stable"],
      priorityOrder: ["Critical", "Stable"],
      arrivalRates: { Critical: 2, Stable: 2 },
      serviceRates: { Critical: 4, Stable: 4 },
      servers: 2,
      capacity: 3,
      serviceDiscipline: ({ state }) => ({ Critical: Math.min(1, state.Critical), Stable: Math.min(1, state.Stable) }),
      admissionPolicy: ({ state, arrivalRates }) => ({
        Critical: state.Critical + state.Stable < 3 ? arrivalRates.Critical : 0,
        Stable: state.Critical === 0 && state.Critical + state.Stable < 3 ? arrivalRates.Stable : 0,
      }),
    });

    expect(custom.serviceAllocation({ Critical: 2, Stable: 1 })).toEqual({ Critical: 1, Stable: 1 });
    expect(custom.admittedArrivalRates({ Critical: 1, Stable: 1 })).toEqual({ Critical: 2, Stable: 0 });
    expectClose(sum(Object.values(custom.stationaryDistribution())), 1);

    expect(() => new MultiClassFiniteQueue({
      classes: ["Critical", "Stable"],
      priorityOrder: ["Critical", "Stable"],
      arrivalRates: { Critical: 1, Stable: 1 },
      serviceRates: { Critical: 2, Stable: 2 },
      servers: 1,
      capacity: 2,
      serviceDiscipline: () => ({ Critical: -1 }),
    }).serviceAllocation({ Critical: 1, Stable: 0 })).toThrow(/service allocation/i);

    expect(() => new MultiClassFiniteQueue({
      classes: ["Critical", "Stable"],
      priorityOrder: ["Critical", "Stable"],
      arrivalRates: { Critical: 1, Stable: 1 },
      serviceRates: { Critical: 2, Stable: 2 },
      servers: 1,
      capacity: 2,
      serviceDiscipline: () => ({ Critical: 2 }),
    }).serviceAllocation({ Critical: 1, Stable: 0 })).toThrow(/exceeds queued count/i);

    expect(() => new MultiClassFiniteQueue({
      classes: ["Critical", "Stable"],
      priorityOrder: ["Critical", "Stable"],
      arrivalRates: { Critical: 1, Stable: 1 },
      serviceRates: { Critical: 2, Stable: 2 },
      servers: 1,
      capacity: 2,
      serviceDiscipline: () => ({ Critical: 1, Stable: 1 }),
    }).serviceAllocation({ Critical: 1, Stable: 1 })).toThrow(/server count/i);

    expect(() => new MultiClassFiniteQueue({
      classes: ["Critical", "Stable"],
      priorityOrder: ["Critical", "Stable"],
      arrivalRates: { Critical: 1, Stable: 1 },
      serviceRates: { Critical: 2, Stable: 2 },
      servers: 1,
      capacity: 2,
      admissionPolicy: () => ({ Critical: 2 }),
    }).admittedArrivalRates({ Critical: 0, Stable: 0 })).toThrow(/exceeds arrival rate/i);

    expect(() => new MultiClassFiniteQueue({
      classes: ["Critical", "Stable"],
      priorityOrder: ["Critical", "Stable"],
      arrivalRates: { Critical: 1, Stable: 1 },
      serviceRates: { Critical: 2, Stable: 2 },
      servers: 1,
      capacity: 2,
      admissionPolicy: () => ({ Critical: -1 }),
    }).admittedArrivalRates({ Critical: 0, Stable: 0 })).toThrow(/admitted arrival rate/i);

    expect(() => new MultiClassFiniteQueue({
      classes: ["Critical", "Stable"],
      priorityOrder: ["Critical", "Stable"],
      arrivalRates: { Critical: 1, Stable: 1 },
      serviceRates: { Critical: 2, Stable: 2 },
      servers: 1,
      capacity: 2,
      admissionPolicy: () => ({ Critical: 1 }),
    }).admittedArrivalRates({ Critical: 2, Stable: 0 })).toThrow(/queue is full/i);
  });

  test("rejects invalid multi-class queue definitions and states", () => {
    const valid = {
      classes: ["Critical", "Stable"] as const,
      priorityOrder: ["Critical", "Stable"] as const,
      arrivalRates: { Critical: 1, Stable: 1 },
      serviceRates: { Critical: 2, Stable: 2 },
      servers: 1,
      capacity: 2,
    };

    expect(() => new MultiClassFiniteQueue({ ...valid, classes: [] })).toThrow(/at least one class/i);
    expect(() => new MultiClassFiniteQueue({ ...valid, priorityOrder: ["Critical"] })).toThrow(/every class/i);
    expect(() => new MultiClassFiniteQueue({ ...valid, priorityOrder: ["Critical", "Missing" as "Stable"] })).toThrow(/unknown priority/i);
    expect(() => new MultiClassFiniteQueue({ ...valid, arrivalRates: { Critical: -1, Stable: 1 } })).toThrow(/arrival rate/i);
    expect(() => new MultiClassFiniteQueue({ ...valid, serviceRates: { Critical: 0, Stable: 2 } })).toThrow(/service rate/i);
    expect(() => new MultiClassFiniteQueue({ ...valid, admissionPolicy: { kind: "priority-reserve", reserves: { Critical: -1 } } })).toThrow(/reserved capacity/i);
    expect(() => PriorityQueueModel.from({ ...valid, priorityOrder: [] })).toThrow(/priorityOrder/i);

    const queue = new MultiClassFiniteQueue(valid);
    expect(() => queue.stateKey({ Critical: -1, Stable: 0 })).toThrow(/nonnegative integer/i);
    expect(() => queue.stateKey({ Critical: 2, Stable: 1 })).toThrow(/exceeds capacity/i);
  });
});

describe("BirthDeathProcess", () => {
  test("computes finite-truncated stationary distributions", () => {
    const birthDeath = new BirthDeathProcess({
      birthRate: () => 2,
      deathRate: (state) => (state === 0 ? 0 : 5),
    });
    const probabilities = birthDeath.stationaryDistribution(4);
    expectClose(sum(Object.values(probabilities)), 1);
    expect(probabilities[0]!).toBeGreaterThan(probabilities[4]!);

    const queueDistribution = birthDeath.stationaryDistribution(5);
    expectClose(sum(Object.values(queueDistribution)), 1);
  });

  test("rejects invalid truncation and invalid birth/death rates", () => {
    const invalidDeath = new BirthDeathProcess({
      birthRate: () => 1,
      deathRate: () => 0,
    });
    expect(() => invalidDeath.stationaryDistribution(2)).toThrow(/death rate/i);

    const invalidBirth = new BirthDeathProcess({
      birthRate: () => -1,
      deathRate: () => 1,
    });
    expect(() => invalidBirth.stationaryDistribution(2)).toThrow(/birth rate/i);
    expect(() => invalidBirth.stationaryDistribution(-1)).toThrow(/maxState/i);
  });
});
