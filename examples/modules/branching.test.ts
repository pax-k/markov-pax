import { describe, expect, test } from "bun:test";
import { GaltonWatsonProcess, SeededRng } from "../../index.ts";

describe("module example: branching processes", () => {
  test("estimates extinction and simulates generations", () => {
    const process = new GaltonWatsonProcess({ 0: 0.3, 2: 0.7 });

    expect(process.classification()).toBe("supercritical");
    expect(process.extinctionProbability()).toBeLessThan(1);
    expect(process.simulateGenerations(1, 4, { rng: new SeededRng(3) })).toHaveLength(5);
  });
});
