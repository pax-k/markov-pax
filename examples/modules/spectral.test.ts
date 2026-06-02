import { describe, expect, test } from "bun:test";
import { MarkovChain, estimateMixingTime, isReversible, relaxationTime, spectralGap } from "../../index.ts";

describe("module example: spectral chain utilities", () => {
  test("uses the spectral gap as a convergence-speed signal", () => {
    const chain = MarkovChain.from({
      Active: { Active: 0.9, Idle: 0.1 },
      Idle: { Active: 0.3, Idle: 0.7 },
    });

    const gap = spectralGap(chain.matrix);

    expect(gap).toBeGreaterThan(0);
    expect(relaxationTime(chain.matrix)).toBeCloseTo(1 / gap);
    expect(estimateMixingTime(chain, { Active: 1 }, { tolerance: 0.05 })).toBeGreaterThan(0);
    expect(isReversible(chain)).toBe(true);
  });
});
