import { describe, expect, test } from "bun:test";
import {
  NonHomogeneousPoissonProcess,
  SeededRng,
} from "../index.ts";

function expectClose(actual: number, expected: number, tolerance = 1e-8) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

describe("NonHomogeneousPoissonProcess", () => {
  test("computes piecewise rates, expected counts, and seeded arrivals", () => {
    const process = new NonHomogeneousPoissonProcess([
      { start: 0, end: 2, rate: 1 },
      { start: 2, end: 4, rate: 3 },
      { start: 4, end: 5, rate: 0 },
    ]);

    expectClose(process.rateAt(1), 1);
    expectClose(process.rateAt(3), 3);
    expectClose(process.rateAt(6), 0);
    expectClose(process.expectedCount(4), 8);
    expectClose(process.expectedCount(1, 3), 4);

    const first = process.eventTimesUntil(4, { rng: new SeededRng(8) });
    const second = process.eventTimesUntil(4, { rng: new SeededRng(8) });
    expect(first).toEqual(second);
    expect(process.countBy(4, { rng: new SeededRng(8) })).toBe(first.length);
  });

  test("rejects invalid intervals and query ranges", () => {
    expect(() => new NonHomogeneousPoissonProcess([])).toThrow(/at least one/i);
    expect(() => new NonHomogeneousPoissonProcess([
      { start: Number.POSITIVE_INFINITY, end: 1, rate: 1 },
    ])).toThrow(/finite/i);
    expect(() => new NonHomogeneousPoissonProcess([
      { start: 0, end: 1, rate: -1 },
    ])).toThrow(/nonnegative/i);
    expect(() => new NonHomogeneousPoissonProcess([
      { start: 1, end: 1, rate: 1 },
    ])).toThrow(/greater/i);
    expect(() => new NonHomogeneousPoissonProcess([
      { start: 0, end: 2, rate: 1 },
      { start: 1, end: 3, rate: 1 },
    ])).toThrow(/non-overlapping/i);

    const process = new NonHomogeneousPoissonProcess([{ start: 0, end: 1, rate: 1 }]);
    expect(() => process.rateAt(-1)).toThrow(/nonnegative/i);
    expect(() => process.expectedCount(2, 1)).toThrow(/at least/i);
    expect(() => process.eventTimesUntil(-1)).toThrow(/nonnegative/i);
  });
});
