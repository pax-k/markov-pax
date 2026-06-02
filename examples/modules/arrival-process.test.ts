import { describe, expect, test } from "bun:test";
import {
  NonHomogeneousPoissonProcess,
  SeededRng,
} from "../../index.ts";

describe("module example: arrival processes", () => {
  test("models ambulance arrivals with piecewise-constant surge rates", () => {
    const arrivals = new NonHomogeneousPoissonProcess([
      { start: 0, end: 6, rate: 2 },
      { start: 6, end: 10, rate: 5 },
      { start: 10, end: 12, rate: 1 },
    ]);

    expect(arrivals.rateAt(7)).toBe(5);
    expect(arrivals.expectedCount(12)).toBe(34);
    expect(arrivals.eventTimesUntil(4, { rng: new SeededRng(21) }).length).toBeGreaterThan(0);
  });
});
