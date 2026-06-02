import { describe, expect, test } from "bun:test";
import { MarkovChain, hittingProbability, isHarmonic } from "../../index.ts";

describe("theory example: harmonic martingales", () => {
  test("checks Ph = h for a hitting-probability harmonic function", () => {
    const chain = MarkovChain.from({
      Lose: { Lose: 1 },
      Mid: { Lose: 0.5, Win: 0.5 },
      Win: { Win: 1 },
    });

    const h = hittingProbability(chain, "Win", ["Lose"]);

    expect(h.Mid).toBeCloseTo(0.5);
    expect(isHarmonic(chain, h)).toBe(true);
  });
});
