import { describe, expect, test } from "bun:test";
import { deterministicHoldingTime, workflows } from "../../index.ts";

describe("real-world example: high-level customer lifecycle workflow", () => {
  test("forecasts a cohort and recommends a retention action without manual model composition", () => {
    const result = workflows.customerLifecycle({
      lifecycle: {
        Trial: { Trial: 0.25, Active: 0.65, Churned: 0.1 },
        Active: { Active: 0.78, Expansion: 0.12, Churned: 0.1 },
        Expansion: { Expansion: 0.88, Active: 0.12 },
        Churned: { Churned: 1 },
      },
      lifecycleStart: { Trial: 1 },
      forecastSteps: 4,
      absorption: {
        Trial: { Trial: 0.2, Converted: 0.65, Churned: 0.15 },
        Converted: { Converted: 1 },
        Churned: { Churned: 1 },
      },
      absorptionFrom: "Trial",
      journeySequences: [
        ["signup", "invite", "activate"],
        ["signup", "docs", "invite"],
        ["signup", "invite", "upgrade"],
      ],
      journeyOrder: 1,
      journeyContext: ["invite"],
      retention: {
        states: ["Trial", "Active"],
        actions: ["Coach", "Wait"],
        discount: 0.82,
        transition: {
          Trial: {
            Coach: { Active: 0.8, Trial: 0.2 },
            Wait: { Active: 0.45, Trial: 0.55 },
          },
          Active: {
            Coach: { Active: 0.86, Trial: 0.14 },
            Wait: { Active: 0.92, Trial: 0.08 },
          },
        },
        reward: {
          Trial: { Coach: 3, Wait: 1 },
          Active: { Coach: 2, Wait: 4 },
        },
      },
      retentionState: "Trial",
      onboarding: {
        transitions: { Setup: { Setup: 0.35, Activated: 0.65 }, Activated: { Activated: 1 } },
        holdingTimes: { Setup: deterministicHoldingTime(2), Activated: deterministicHoldingTime(1) },
        start: "Setup",
        horizon: 5,
        seed: 13,
      },
      uncertainty: {
        parameter: "conversion",
        initial: 0.45,
        logTarget: (p) => p > 0 && p < 1 ? -((p - 0.62) ** 2) / 0.02 : Number.NEGATIVE_INFINITY,
        iterations: 70,
        burnIn: 10,
        seed: 17,
      },
    }).analyze();

    expect(result.recommendedAction).toBe("Coach");
    expect((result.forecast as Record<string, number>).Active).toBeGreaterThan(0.2);
    expect(result.details.absorption).toBeDefined();
    expect(result.details.journeyPrediction).toBeDefined();
    expect(result.details.onboardingSimulation).toBeDefined();
    expect(result.uncertainty!.conversion!.samples.length).toBe(60);
  });
});
