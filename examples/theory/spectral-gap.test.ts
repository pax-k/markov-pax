import { describe, expect, test } from "bun:test";
import { MarkovChain, estimateMixingTime, spectralGap } from "../../index.ts";

describe("theory example: spectral gap", () => {
  test("larger spectral gaps imply faster approach to stationarity", () => {
    const fast = MarkovChain.from({ A: { A: 0.6, B: 0.4 }, B: { A: 0.4, B: 0.6 } });
    const slow = MarkovChain.from({ A: { A: 0.95, B: 0.05 }, B: { A: 0.05, B: 0.95 } });

    expect(spectralGap(fast.matrix)).toBeGreaterThan(spectralGap(slow.matrix));
    expect(estimateMixingTime(fast, { A: 1 }, { tolerance: 0.1 })).toBeLessThan(
      estimateMixingTime(slow, { A: 1 }, { tolerance: 0.1 }),
    );
  });
});
