import { describe, expect, test } from "bun:test";
import {
  MarkovChain,
  SeededRng,
} from "../../index.ts";

function expectClose(actual: number, expected: number, tolerance = 1e-8) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

function sum(values: Iterable<number>) {
  return Array.from(values).reduce((total, value) => total + value, 0);
}

describe("module example: MarkovChain", () => {
  test("forecasts state distributions and simulates paths", () => {
    const chain = MarkovChain.from({
      New: { New: 0.2, Active: 0.7, Churned: 0.1 },
      Active: { Active: 0.85, Churned: 0.15 },
      Churned: { Churned: 1 },
    });

    const afterThreeMonths = chain.distributionAfter({ New: 1 }, 3);
    const steadyState = chain.stationary();
    const simulatedPath = chain.simulate("New", 4, { rng: new SeededRng(4) });

    expectClose(sum(Object.values(afterThreeMonths)), 1);
    expect(afterThreeMonths.Active).toBeGreaterThan(0.4);
    expectClose(sum(Object.values(steadyState)), 1);
    expect(simulatedPath[0]).toBe("New");
    expect(simulatedPath).toHaveLength(5);
  });
});
