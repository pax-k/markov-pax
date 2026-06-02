import { describe, expect, test } from "bun:test";
import {
  KernelChain,
  SeededRng,
  empiricalDistribution,
  estimateExpectation,
  finiteKernel,
  simulateKernel,
  type TransitionKernel,
} from "../index.ts";

describe("general transition kernels", () => {
  test("simulate arbitrary and finite kernels", () => {
    const increment: TransitionKernel<number> = { sample: (state) => state + 1 };
    expect(simulateKernel(increment, 0, 3)).toEqual([0, 1, 2, 3]);
    expect(new KernelChain(increment).step(4)).toBe(5);

    const kernel = finiteKernel({
      A: { A: 0.25, B: 0.75 },
      B: { A: 1 },
    });
    const path = new KernelChain(kernel).simulate("A", 4, { rng: new SeededRng(1) });
    expect(path).toHaveLength(5);
    const empirical = empiricalDistribution(path);
    expect(empirical.A + empirical.B).toBeCloseTo(1);
    expect(estimateExpectation(path, (state) => (state === "A" ? 1 : 0))).toBeGreaterThan(0);
  });

  test("rejects invalid kernel usage", () => {
    expect(() => finiteKernel({} as Record<string, never>)).toThrow();
    expect(() => finiteKernel({ A: { A: 1 } }).sample("B" as "A", new SeededRng(1))).toThrow();
    expect(() => simulateKernel({ sample: (state: number) => state }, 0, -1)).toThrow();
    expect(() => empiricalDistribution([])).toThrow();
    expect(() => estimateExpectation([], () => 0)).toThrow();
    expect(() => estimateExpectation([1], () => Number.NaN)).toThrow();
  });
});
