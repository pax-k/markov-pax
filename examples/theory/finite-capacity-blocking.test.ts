import { describe, expect, test } from "bun:test";
import { MMcKQueue } from "../../index.ts";

describe("theory example: finite-capacity blocking", () => {
  test("uses the full-capacity stationary mass as blocking probability", () => {
    const queue = new MMcKQueue({ arrivalRate: 5, serviceRate: 3, servers: 2, capacity: 4 });
    const stationary = queue.stationaryDistribution();

    expect(queue.blockingProbability()).toBeCloseTo(stationary[4]!);
    expect(queue.effectiveArrivalRate()).toBeCloseTo(5 * (1 - stationary[4]!));
  });
});
