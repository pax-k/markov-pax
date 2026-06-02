import { describe, expect, test } from "bun:test";
import { SeededRng, geometricBrownianMotion, ornsteinUhlenbeck } from "../../index.ts";

describe("real-world example: asset prices and sensor drift", () => {
  test("simulates a risky asset and mean-reverting measurement error", () => {
    const asset = geometricBrownianMotion({ drift: 0.06, volatility: 0.25 });
    const priceSummary = asset.terminalSummary({
      initial: 100,
      dt: 1 / 252,
      steps: 30,
      paths: 20,
      rng: new SeededRng(101),
    });

    const sensor = ornsteinUhlenbeck({ mean: 0, theta: 3, volatility: 0.05 });
    const driftPath = sensor.simulatePath({ initial: 1, dt: 0.1, steps: 5, rng: new SeededRng(102) });

    expect(priceSummary.terminals.every((price) => price > 0)).toBe(true);
    expect(driftPath.at(-1)!.value).toBeLessThan(1);
  });
});
