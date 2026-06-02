import { describe, expect, test } from "bun:test";
import {
  BirthDeathProcess,
  MM1Queue,
} from "../../index.ts";

function sum(values: Iterable<number>) {
  return Array.from(values).reduce((total, value) => total + value, 0);
}

describe("module example: queues", () => {
  test("computes M/M/1 metrics and a birth-death stationary distribution", () => {
    const queue = new MM1Queue({ arrivalRate: 4, serviceRate: 10 });

    expect(queue.rho()).toBeCloseTo(0.4);
    expect(queue.expectedNumberInSystem()).toBeCloseTo(2 / 3);
    expect(queue.expectedTimeInSystem()).toBeCloseTo(1 / 6);

    const birthDeath = new BirthDeathProcess({
      birthRate: () => 4,
      deathRate: (state) => (state === 0 ? 0 : 10),
    });
    const distribution = birthDeath.stationaryDistribution(4);

    expect(sum(Object.values(distribution))).toBeCloseTo(1);
    expect(distribution[0]).toBeGreaterThan(distribution[4]!);
  });
});
