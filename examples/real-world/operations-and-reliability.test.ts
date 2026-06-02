import { describe, expect, test } from "bun:test";
import {
  BirthDeathProcess,
  CTMC,
  MM1Queue,
} from "../../index.ts";

function expectClose(actual: number, expected: number, tolerance = 1e-8) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

function sum(values: Iterable<number>) {
  return Array.from(values).reduce((total, value) => total + value, 0);
}

describe("real-world example: service reliability and repair planning", () => {
  test("computes expected availability for a repairable production service", () => {
    const service = CTMC.fromGenerator({
      Healthy: { Healthy: -0.02, Degraded: 0.02, Down: 0 },
      Degraded: { Healthy: 0.5, Degraded: -0.55, Down: 0.05 },
      Down: { Healthy: 0, Degraded: 1, Down: -1 },
    });

    const steady = service.stationary();
    const availability = steady.Healthy + steady.Degraded;
    const twoHourTransition = service.transitionMatrix(2);

    expectClose(sum(Object.values(steady)), 1);
    expect(availability).toBeGreaterThan(0.97);
    for (const row of twoHourTransition) {
      expectClose(sum(row), 1);
    }
  });
});

describe("real-world example: support queue sizing", () => {
  test("estimates wait time for a single-agent support channel", () => {
    const queue = new MM1Queue({
      arrivalRate: 18,
      serviceRate: 24,
    });

    const expectedWaitMinutes = queue.expectedTimeInQueue() * 60;
    const expectedSystemMinutes = queue.expectedTimeInSystem() * 60;

    expectClose(queue.rho(), 0.75);
    expect(expectedWaitMinutes).toBeLessThanOrEqual(7.5);
    expect(expectedSystemMinutes).toBeLessThanOrEqual(10);
  });
});

describe("real-world example: finite-capacity clinic queue approximation", () => {
  test("computes the chance of seeing a short versus long waiting room", () => {
    const clinic = new BirthDeathProcess({
      birthRate: (patientsWaiting) => (patientsWaiting >= 5 ? 0 : 6),
      deathRate: (patientsWaiting) => (patientsWaiting === 0 ? 0 : 8),
    });

    const distribution = clinic.stationaryDistribution(5);
    const lightLoad = distribution[0]! + distribution[1]!;
    const crowded = distribution[4]! + distribution[5]!;

    expectClose(sum(Object.values(distribution)), 1);
    expect(lightLoad).toBeGreaterThan(crowded);
    expect(distribution[5]!).toBeLessThan(0.1);
  });
});
