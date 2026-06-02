import { describe, expect, test } from "bun:test";
import { GaltonWatsonProcess } from "../../index.ts";

describe("theory example: Galton-Watson branching", () => {
  test("classifies reproduction by the mean offspring count", () => {
    const process = new GaltonWatsonProcess({ 0: 0.6, 1: 0.2, 2: 0.2 });

    expect(process.meanOffspring()).toBeCloseTo(0.6);
    expect(process.classification()).toBe("subcritical");
    expect(process.extinctionProbability()).toBe(1);
  });
});
