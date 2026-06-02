import { describe, expect, test } from "bun:test";
import { CTMC, SeededRng } from "../index.ts";

function expectClose(actual: number, expected: number, tolerance = 1e-8) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

function sum(values: Iterable<number>) {
  return Array.from(values).reduce((total, value) => total + value, 0);
}

function expectDistribution(distribution: Record<string, number>, tolerance = 1e-8) {
  for (const value of Object.values(distribution)) {
    expect(value).toBeGreaterThanOrEqual(-tolerance);
    expect(value).toBeLessThanOrEqual(1 + tolerance);
  }
  expectClose(sum(Object.values(distribution)), 1, tolerance);
}

describe("CTMC", () => {
  test("computes transition probabilities, stationary distribution, and seeded simulation", () => {
    const ctmc = CTMC.fromGenerator({
      Up: { Up: -0.1, Down: 0.1 },
      Down: { Up: 0.4, Down: -0.4 },
    });

    const transition = ctmc.transitionMatrix(2);
    for (const row of transition) {
      expectClose(sum(row), 1, 1e-8);
    }

    const stationary = ctmc.stationary();
    expectDistribution(stationary);
    expectClose(stationary.Up, 0.8, 1e-8);
    expectClose(stationary.Down, 0.2, 1e-8);

    const path = ctmc.simulate("Up", 5, { rng: new SeededRng(9) });
    expect(path[0]!.state).toBe("Up");
    expect(path.every((event) => event.time >= 0)).toBe(true);
  });

  test("covers default simulation, zero-generator, constructor, and absorbing CTMC branches", () => {
    const ctmc = CTMC.fromGenerator({
      Up: { Up: -1, Down: 1 },
      Down: { Down: 0 },
    });

    const path = ctmc.simulate("Up", 0.001);
    expect(path[0]).toEqual({ state: "Up", time: 0 });
    expect(path.every((event) => event.time >= 0)).toBe(true);
    expect(() => ctmc.simulate("Missing" as "Up", 1)).toThrow(/unknown state/i);

    expect(() => new CTMC(["A", "B"], [[0]])).toThrow(/match/i);

    const frozen = CTMC.fromGenerator({
      Still: { Still: 0 },
    });
    expect(frozen.transitionMatrix(5)).toEqual([[1]]);
    expect(frozen.transitionMatrix(0)).toEqual([[1]]);
    expect(frozen.simulate("Still", 10)).toEqual([{ state: "Still", time: 0 }]);
    expect(() => frozen.simulate("Still", -1)).toThrow(/horizon/i);

    const fast = CTMC.fromGenerator({
      A: { A: -1000, B: 1000 },
      B: { B: 0 },
    });
    const fastPath = fast.simulate("A", 1, { rng: new SeededRng(1) });
    expect(fastPath.map((event) => event.state)).toEqual(["A", "B"]);

    const degrading = CTMC.fromGenerator({
      Working: { Working: -1, Failed: 1 },
      Failed: { Working: 0, Failed: 0 },
    });
    expect(degrading.stationary()).toEqual({ Working: 0, Failed: 1 });
  });

  test("rejects invalid generators and invalid transition settings", () => {
    expect(() => CTMC.fromGenerator({
      A: { A: -1, B: -0.5 },
      B: { A: 0.5, B: -0.5 },
    })).toThrow(/off-diagonal/i);

    expect(() => CTMC.fromGenerator({
      A: { A: -1, B: 0.25 },
      B: { A: 0.5, B: -0.5 },
    })).toThrow(/sum to 0/i);

    expect(() => CTMC.fromGenerator({
      A: { A: 0.1, B: -0.1 },
      B: { A: 0.5, B: -0.5 },
    })).toThrow(/diagonal|off-diagonal/i);

    expect(() => CTMC.fromGenerator<"A" | "B">({
      A: { A: -1, B: 1, Missing: 0 },
      B: { A: 1, B: -1 },
    } as any)).toThrow(/unknown destination/i);

    const ctmc = CTMC.fromGenerator({
      Up: { Up: -0.1, Down: 0.1 },
      Down: { Up: 0.4, Down: -0.4 },
    });
    expect(() => ctmc.transitionMatrix(-1)).toThrow(/time/i);
    expect(() => ctmc.transitionMatrix(1, { maxTerms: 0 })).toThrow(/did not converge/i);
  });
});
