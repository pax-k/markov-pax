import { describe, expect, test } from "bun:test";
import {
  CTMC,
  SeededRng,
} from "../../index.ts";

function expectClose(actual: number, expected: number, tolerance = 1e-8) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

function sum(values: Iterable<number>) {
  return Array.from(values).reduce((total, value) => total + value, 0);
}

describe("module example: CTMC", () => {
  test("models continuous-time failure and repair", () => {
    const service = CTMC.fromGenerator({
      Up: { Up: -0.05, Down: 0.05 },
      Down: { Up: 0.45, Down: -0.45 },
    });

    const oneHour = service.transitionMatrix(1);
    const steady = service.stationary();
    const path = service.simulate("Up", 2, { rng: new SeededRng(12) });

    for (const row of oneHour) {
      expectClose(sum(row), 1);
    }
    expect(steady.Up).toBeGreaterThan(0.85);
    expect(path[0]).toEqual({ state: "Up", time: 0 });
  });
});
