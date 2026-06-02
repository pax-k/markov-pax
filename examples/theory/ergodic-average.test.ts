import { describe, expect, test } from "bun:test";
import { MarkovChain, SeededRng, compareTimeAndStationaryAverage } from "../../index.ts";

describe("theory example: ergodic averages", () => {
  test("compares 1/n sum f(X_k) with E_pi[f]", () => {
    const chain = MarkovChain.from({ A: { A: 0.7, B: 0.3 }, B: { A: 0.2, B: 0.8 } });
    const result = compareTimeAndStationaryAverage(chain, "A", 200, (state) => (state === "B" ? 1 : 0), {
      rng: new SeededRng(4),
    });

    expect(Math.abs(result.difference)).toBeLessThan(0.2);
  });
});
