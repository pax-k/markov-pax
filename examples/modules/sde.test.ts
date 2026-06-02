import { describe, expect, test } from "bun:test";
import { SeededRng, geometricBrownianMotion, ornsteinUhlenbeck } from "../../index.ts";

describe("module example: diffusions and SDEs", () => {
  test("simulates scalar stochastic differential equations", () => {
    const asset = geometricBrownianMotion({ drift: 0.04, volatility: 0.2 });
    const prices = asset.simulatePath({ initial: 100, dt: 1 / 252, steps: 10, rng: new SeededRng(5) });

    const sensor = ornsteinUhlenbeck({ mean: 0, theta: 2, volatility: 0.1 });
    const drift = sensor.simulatePath({ initial: 2, dt: 0.1, steps: 1, rng: new SeededRng(5) });

    expect(prices.every((point) => point.value > 0)).toBe(true);
    expect(drift.at(-1)!.value).toBeLessThan(2);
  });
});
