import { describe, expect, test } from "bun:test";
import {
  MarkovChain,
  SeededRng,
  vectorDistance,
} from "../index.ts";

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

describe("MarkovChain", () => {
  const weather = MarkovChain.from({
    Sunny: { Sunny: 0.7, Cloudy: 0.2, Rainy: 0.1 },
    Cloudy: { Sunny: 0.3, Cloudy: 0.4, Rainy: 0.3 },
    Rainy: { Sunny: 0.2, Cloudy: 0.3, Rainy: 0.5 },
  });

  test("forecasts distributions, paths, and stationary behavior", () => {
    const forecast = weather.distributionAfter({ Sunny: 1 }, 2);
    expectClose(forecast.Sunny, 0.57);
    expectClose(forecast.Cloudy, 0.25);
    expectClose(forecast.Rainy, 0.18);

    expectClose(weather.probabilityAfter("Sunny", "Rainy", 2), 0.18);
    expectClose(weather.pathProbability(["Sunny", "Cloudy", "Rainy"]), 0.06);

    const stationary = weather.stationary();
    expectDistribution(stationary);
    expectClose(stationary.Sunny, 0.456521739, 1e-6);
    expectClose(stationary.Cloudy, 0.282608695, 1e-6);
    expectClose(stationary.Rainy, 0.260869565, 1e-6);

    const cloudyStart = weather.distributionAfter({ Cloudy: 1 }, 100);
    expect(vectorDistance(
      weather.toVector(cloudyStart),
      weather.toVector(stationary),
    )).toBeLessThan(1e-8);

    expectDistribution(weather.step({ Sunny: 1, Cloudy: 0, Rainy: 0 }));
    for (const row of weather.nStep(4)) {
      expectClose(sum(row), 1);
    }
  });

  test("classifies connectivity, recurrence, periods, and absorbing states", () => {
    expect(weather.isIrreducible()).toBe(true);
    expect(weather.isAperiodic()).toBe(true);
    expect(weather.period("Sunny")).toBe(1);

    const classification = weather.classify();
    expect(classification.Sunny.recurrent).toBe(true);
    expect(classification.Cloudy.communicatingClass).toBe(0);

    const reducible = MarkovChain.from({
      A: { A: 1 },
      B: { B: 1 },
      C: { A: 0.5, B: 0.5 },
    });

    expect(reducible.isIrreducible()).toBe(false);
    const reducibleClassification = reducible.classify();
    expect(reducibleClassification.A.recurrent).toBe(true);
    expect(reducibleClassification.B.recurrent).toBe(true);
    expect(reducibleClassification.C.transient).toBe(true);
    expect(reducibleClassification.A.absorbing).toBe(true);
    expect(reducibleClassification.B.absorbing).toBe(true);

    const periodic = MarkovChain.from({
      A: { B: 1 },
      B: { A: 1 },
    });
    expect(periodic.isIrreducible()).toBe(true);
    expect(periodic.isAperiodic()).toBe(false);
    expect(periodic.period("A")).toBe(2);
    expect(periodic.distributionAfter({ A: 1 }, 3)).toEqual({ A: 0, B: 1 });
    expect(() => periodic.stationaryByPower({ maxIterations: 0 })).toThrow(/did not converge/i);
  });

  test("simulates with injected and default RNGs and converts vectors", () => {
    const path = weather.simulate("Sunny", 6, { rng: new SeededRng(123) });
    expect(path).toEqual(["Sunny", "Sunny", "Sunny", "Sunny", "Sunny", "Sunny", "Sunny"]);

    const chain = MarkovChain.from({
      A: { A: 0.2, B: 0.8 },
      B: { A: 0.5, B: 0.5 },
    });

    expect(chain.stepFrom("A")).toEqual({ A: 0.2, B: 0.8 });
    expect(chain.fromVector([0.3, 0.7])).toEqual({ A: 0.3, B: 0.7 });
    expect(chain.toVector({ A: 2, B: 1 }, { normalize: true })).toEqual([2 / 3, 1 / 3]);
    expect(() => chain.stepFrom("Missing" as "A")).toThrow(/unknown state/i);

    const deterministic = MarkovChain.from({
      A: { B: 1 },
      B: { B: 1 },
    });
    expect(deterministic.simulate("A", 1)).toEqual(["A", "B"]);
  });

  test("validates construction, normalization, unknown states, and invalid steps", () => {
    expect(() => MarkovChain.from({
      A: { A: 1.2, B: -0.2 },
      B: { A: 0.5, B: 0.5 },
    })).toThrow(/probability/i);

    expect(() => MarkovChain.from({
      A: { A: 0.4 },
      B: { B: 1 },
    })).toThrow(/sum to 1/i);

    expect(() => MarkovChain.from<"A" | "B">({
      A: { A: 0.5, C: 0.5 },
      B: { B: 1 },
    } as any)).toThrow(/unknown destination/i);

    expect(() => MarkovChain.fromMatrix(["A", "A"], [
      [1, 0],
      [0, 1],
    ])).toThrow(/duplicate/i);

    const normalized = MarkovChain.from({
      A: { A: 2, B: 2 },
      B: { A: 1, B: 3 },
    }, { normalize: true });
    expectClose(normalized.transitionProbability("A", "A"), 0.5);
    expectClose(normalized.transitionProbability("A", "B"), 0.5);
    expectClose(normalized.transitionProbability("B", "B"), 0.75);

    const chain = MarkovChain.from({
      A: { A: 1 },
      B: { A: 1 },
    });
    expect(() => chain.transitionProbability("A", "Missing" as "A")).toThrow(/unknown state/i);
    expect(() => chain.distributionAfter({ A: 0.7, B: 0.7 }, 1)).toThrow(/sum to 1/i);
    expect(() => chain.simulate("A", -1)).toThrow(/steps/i);
  });
});
