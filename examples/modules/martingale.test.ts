import { describe, expect, test } from "bun:test";
import { MarkovChain, hittingProbability, isHarmonic } from "../../index.ts";

describe("module example: harmonic functions", () => {
  test("solves a gambler's ruin hitting-probability problem", () => {
    const chain = MarkovChain.from({
      "0": { "0": 1 },
      "1": { "0": 0.5, "2": 0.5 },
      "2": { "1": 0.5, "3": 0.5 },
      "3": { "3": 1 },
    });

    const h = hittingProbability(chain, "3", ["0"]);

    expect(h["1"]).toBeCloseTo(1 / 3);
    expect(isHarmonic(chain, h)).toBe(true);
  });
});
