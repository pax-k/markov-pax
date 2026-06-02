import { describe, expect, test } from "bun:test";
import {
  Diffusion1D,
  SeededRng,
  brownianMotion,
  geometricBrownianMotion,
  langevinDiffusion1D,
  ornsteinUhlenbeck,
} from "../index.ts";

describe("scalar SDE and diffusion helpers", () => {
  test("simulates Brownian, OU, GBM, and Langevin paths", () => {
    const brownian = brownianMotion(0.2);
    const path = brownian.simulatePath({ initial: 0, dt: 0.1, steps: 3, rng: new SeededRng(1) });
    expect(path).toHaveLength(4);
    expect(path.at(-1)!.time).toBeCloseTo(0.3);

    const ou = ornsteinUhlenbeck({ mean: 10, theta: 1, volatility: 0.1 });
    expect(ou.simulatePath({ initial: 0, dt: 0.1, steps: 1, rng: new SeededRng(1) }).at(-1)!.value).toBeGreaterThan(0);

    const gbm = geometricBrownianMotion({ drift: 0.05, volatility: 0.2 });
    expect(gbm.drift(100, 0)).toBeCloseTo(5);
    expect(gbm.volatility(100, 0)).toBeCloseTo(20);
    expect(gbm.simulatePath({ initial: 100, dt: 1 / 252, steps: 5, rng: new SeededRng(2) }).every((point) => point.value > 0)).toBe(true);

    const langevin = langevinDiffusion1D((x) => -x);
    const summary = langevin.terminalSummary({ initial: 1, dt: 0.05, steps: 5, paths: 3, rng: new SeededRng(3) });
    expect(summary.terminals).toHaveLength(3);
    expect(summary.variance).toBeGreaterThanOrEqual(0);
  });

  test("rejects invalid diffusion parameters and nonfinite dynamics", () => {
    expect(() => brownianMotion(0)).toThrow();
    expect(() => ornsteinUhlenbeck({ mean: 0, theta: 0, volatility: 1 })).toThrow();
    expect(() => geometricBrownianMotion({ drift: 0, volatility: 0 })).toThrow();
    expect(() => langevinDiffusion1D(() => 0, 0)).toThrow();
    expect(() => brownianMotion().simulatePath({ initial: Number.NaN, dt: 1, steps: 1 })).toThrow();
    expect(() => brownianMotion().simulatePath({ initial: 0, dt: 0, steps: 1 })).toThrow();
    expect(() => brownianMotion().simulatePath({ initial: 0, dt: 1, steps: -1 })).toThrow();
    expect(() => brownianMotion().simulateMany({ initial: 0, dt: 1, steps: 1, paths: 0 })).toThrow();
    expect(() => new Diffusion1D(() => Number.POSITIVE_INFINITY, () => 1).simulatePath({ initial: 0, dt: 1, steps: 1 })).toThrow();
    expect(() => new Diffusion1D(() => 0, () => Number.NaN).simulatePath({ initial: 0, dt: 1, steps: 1 })).toThrow();
    expect(() => new Diffusion1D(() => 0, () => 1, () => Number.NaN).simulatePath({ initial: 0, dt: 1, steps: 1 })).toThrow();
  });
});
