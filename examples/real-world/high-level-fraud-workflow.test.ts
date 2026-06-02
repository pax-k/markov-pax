import { describe, expect, test } from "bun:test";
import { workflows } from "../../index.ts";

describe("real-world example: high-level fraud workflow", () => {
  test("turns account events into a risk belief, response action, and uncertainty summary", () => {
    const result = workflows.fraudDetection({
      hiddenState: {
        states: ["Clean", "Compromised"],
        observations: ["normal-login", "velocity-spike"],
        initial: { Clean: 0.96, Compromised: 0.04 },
        transition: {
          Clean: { Clean: 0.9, Compromised: 0.1 },
          Compromised: { Clean: 0.15, Compromised: 0.85 },
        },
        emission: {
          Clean: { "normal-login": 0.9, "velocity-spike": 0.1 },
          Compromised: { "normal-login": 0.2, "velocity-spike": 0.8 },
        },
      },
      response: {
        states: ["Clean", "Compromised"],
        actions: ["Approve", "StepUp"],
        discount: 0.8,
        transition: {
          Clean: {
            Approve: { Clean: 0.92, Compromised: 0.08 },
            StepUp: { Clean: 0.98, Compromised: 0.02 },
          },
          Compromised: {
            Approve: { Clean: 0.05, Compromised: 0.95 },
            StepUp: { Clean: 0.7, Compromised: 0.3 },
          },
        },
        reward: {
          Clean: { Approve: 4, StepUp: 1 },
          Compromised: { Approve: -10, StepUp: 2 },
        },
      },
      responseState: "Compromised",
      loss: {
        Review: { Review: 0.35, Cleared: 0.5, Loss: 0.15 },
        Cleared: { Cleared: 1 },
        Loss: { Loss: 1 },
      },
      lossFrom: "Review",
      riskGraph: {
        account: ["device", "card"],
        device: ["account", "ip"],
        card: ["merchant"],
        ip: ["device"],
        merchant: ["card"],
      },
      uncertainty: {
        parameter: "fraudBaseRate",
        initial: 0.12,
        logTarget: (p) => p > 0 && p < 1 ? -((p - 0.18) ** 2) / 0.015 : Number.NEGATIVE_INFINITY,
        iterations: 80,
        burnIn: 10,
        seed: 19,
      },
    }).assess({ observations: ["normal-login", "velocity-spike", "velocity-spike"] });

    expect(result.inferredState).toBe("Compromised");
    expect(result.recommendedAction).toBe("StepUp");
    expect(result.details.rankedEntities).toBeDefined();
    expect(result.uncertainty!.fraudBaseRate!.samples.length).toBe(70);
  });
});
