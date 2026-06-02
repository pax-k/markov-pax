import { describe, expect, test } from "bun:test";
import {
  RenewalProcess,
  SeededRng,
  SemiMarkovProcess,
  deterministicHoldingTime,
  exponentialHoldingTime,
  renewalReward,
} from "../../index.ts";

describe("real-world example: maintenance cycles and state durations", () => {
  test("models scheduled inspections and repair occupancy", () => {
    const inspections = new RenewalProcess(deterministicHoldingTime(90));
    const inspectionBudget = renewalReward(inspections, 365, 250);

    const asset = SemiMarkovProcess.from(
      { Healthy: { Healthy: 0.7, Repair: 0.3 }, Repair: { Healthy: 1 } },
      { Healthy: deterministicHoldingTime(30), Repair: exponentialHoldingTime(1 / 5) },
    );
    const occupancy = asset.occupancyTimes(asset.simulateUntil(180, "Healthy", { rng: new SeededRng(12) }));

    expect(inspectionBudget).toBe(1_000);
    expect(occupancy.Healthy + occupancy.Repair).toBeCloseTo(180);
  });
});
