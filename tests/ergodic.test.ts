import { describe, expect, test } from "bun:test";
import {
  MarkovChain,
  SeededRng,
  autocorrelation,
  batchMeans,
  compareTimeAndStationaryAverage,
  effectiveSampleSize,
  runningMean,
  stationaryExpectation,
  timeAverage,
} from "../index.ts";

describe("ergodic utilities", () => {
  test("computes time averages, stationary expectations, and diagnostics", () => {
    expect(timeAverage(["A", "B", "B"], (state) => (state === "B" ? 1 : 0))).toBeCloseTo(2 / 3);
    expect(runningMean([1, 3, 5])).toEqual([1, 2, 3]);
    expect(autocorrelation([1, 2, 3, 4], 0)).toBe(1);
    expect(autocorrelation([1, 1, 1], 1)).toBe(0);
    expect(effectiveSampleSize([1, -1, 1, -1])).toBeGreaterThan(0);
    expect(batchMeans([1, 2, 3, 4], 2)).toEqual([1.5, 3.5]);

    const chain = MarkovChain.from({ Up: { Up: 0.8, Down: 0.2 }, Down: { Up: 0.4, Down: 0.6 } });
    const observable = (state: "Up" | "Down") => (state === "Up" ? 1 : 0);
    expect(stationaryExpectation(chain, observable)).toBeCloseTo(2 / 3);
    const comparison = compareTimeAndStationaryAverage(chain, "Up", 20, observable, { rng: new SeededRng(2) });
    expect(Number.isFinite(comparison.difference)).toBe(true);
  });

  test("rejects invalid ergodic inputs", () => {
    expect(() => timeAverage([], () => 0)).toThrow();
    expect(() => timeAverage([1], () => Number.NaN)).toThrow();
    expect(() => runningMean([])).toThrow();
    expect(() => runningMean([Number.NaN])).toThrow();
    expect(() => autocorrelation([1, 2], 2)).toThrow();
    expect(() => effectiveSampleSize([1])).toThrow();
    expect(() => batchMeans([1], 0)).toThrow();
    expect(() => batchMeans([1], 2)).toThrow();
    const chain = MarkovChain.from({ A: { A: 1 } });
    expect(() => stationaryExpectation(chain, () => Number.NaN)).toThrow();
  });
});
