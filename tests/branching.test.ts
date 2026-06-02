import { describe, expect, test } from "bun:test";
import { GaltonWatsonProcess, SeededRng } from "../index.ts";

describe("GaltonWatsonProcess", () => {
  test("classifies, simulates, and estimates extinction", () => {
    const subcritical = new GaltonWatsonProcess({ 0: 0.6, 1: 0.4 });
    expect(subcritical.meanOffspring()).toBeCloseTo(0.4);
    expect(subcritical.classification()).toBe("subcritical");
    expect(subcritical.extinctionProbability()).toBe(1);
    expect(subcritical.simulateGenerations(2, 3, { rng: new SeededRng(1) })).toHaveLength(4);
    expect(Object.values(subcritical.generationDistribution(1, 2, 5, { rng: new SeededRng(2) })).reduce((a, b) => a + b, 0)).toBeCloseTo(1);

    const critical = new GaltonWatsonProcess({ 1: 1 });
    expect(critical.classification()).toBe("critical");

    const supercritical = new GaltonWatsonProcess({ 0: 0.25, 2: 0.75 });
    expect(supercritical.classification()).toBe("supercritical");
    expect(supercritical.extinctionProbability()).toBeLessThan(1);
  });

  test("rejects invalid branching inputs", () => {
    expect(() => new GaltonWatsonProcess({ "-1": 1 })).toThrow();
    expect(() => new GaltonWatsonProcess({ "1.5": 1 })).toThrow();
    const process = new GaltonWatsonProcess({ 0: 0.25, 2: 0.75 });
    expect(() => process.extinctionProbability({ maxIterations: 0 })).toThrow();
    expect(() => process.simulateGenerations(-1, 1)).toThrow();
    expect(() => process.simulateGenerations(1, -1)).toThrow();
    expect(() => process.generationDistribution(1, 1, 0)).toThrow();
  });
});
