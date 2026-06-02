import { describe, expect, test } from "bun:test";
import { SeededRng, brownianMotion } from "../../index.ts";

describe("theory example: Euler-Maruyama", () => {
  test("approximates dX_t = sigma dW_t with normal increments", () => {
    const path = brownianMotion(1).simulatePath({ initial: 0, dt: 0.01, steps: 100, rng: new SeededRng(2) });

    expect(path).toHaveLength(101);
    expect(path.at(-1)!.time).toBeCloseTo(1);
  });
});
