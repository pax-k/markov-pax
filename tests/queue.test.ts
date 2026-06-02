import { describe, expect, test } from "bun:test";
import {
  BirthDeathProcess,
  MM1Queue,
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
