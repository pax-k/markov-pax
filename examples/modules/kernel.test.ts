import { describe, expect, test } from "bun:test";
import { KernelChain, SeededRng, empiricalDistribution, estimateExpectation, finiteKernel } from "../../index.ts";

describe("module example: transition kernels", () => {
  test("simulates an arbitrary-state Markov process", () => {
    const kernel = finiteKernel({
      low: { low: 0.7, high: 0.3 },
      high: { low: 0.2, high: 0.8 },
    });

    const path = new KernelChain(kernel).simulate("low", 20, { rng: new SeededRng(10) });
    const occupancy = empiricalDistribution(path);

    expect(occupancy.low + occupancy.high).toBeCloseTo(1);
    expect(estimateExpectation(path, (state) => (state === "high" ? 1 : 0))).toBeGreaterThan(0);
  });
});
