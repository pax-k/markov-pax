import { describe, expect, test } from "bun:test";
import {
  AbsorbingChain,
  HigherOrderMarkovModel,
  MDP,
  MarkovChain,
  SeededRng,
  SemiMarkovProcess,
  deterministicHoldingTime,
  metropolisHastings,
  uniformHoldingTime,
} from "../../index.ts";

function sum(values: Iterable<number>) {
  return Array.from(values).reduce((total, value) => total + value, 0);
}

describe("real-world example: SaaS growth lab", () => {
  test("connects lifecycle forecasting, journey prediction, retention policy, and conversion uncertainty", () => {
    const lifecycle = MarkovChain.from({
      Trial: { Trial: 0.15, Activated: 0.5, Dormant: 0.25, Churned: 0.1 },
      Activated: { Activated: 0.72, Expansion: 0.1, Dormant: 0.12, Churned: 0.06 },
      Expansion: { Activated: 0.15, Expansion: 0.78, Churned: 0.07 },
      Dormant: { Activated: 0.18, Dormant: 0.52, Churned: 0.3 },
      Churned: { Churned: 1 },
    });
    const monthSix = lifecycle.distributionAfter({ Trial: 1 }, 6);

    const churn = AbsorbingChain.from({
      Trial: { Activated: 0.75, Churned: 0.25 },
      Activated: { Activated: 0.2, Expanded: 0.65, Churned: 0.15 },
      Expanded: { Expanded: 1 },
      Churned: { Churned: 1 },
    });

    const journey = HigherOrderMarkovModel.fit(
      [
        ["Home", "Docs", "API", "Billing", "Activated"],
        ["Home", "Pricing", "Signup", "Docs", "Activated"],
        ["Home", "Docs", "API", "Billing", "Activated"],
      ],
      { order: 2, smoothing: 0.1 },
    );

    const onboarding = SemiMarkovProcess.from(
      { Trial: { Setup: 1 }, Setup: { Activated: 0.8, Churned: 0.2 }, Activated: { Activated: 1 }, Churned: { Churned: 1 } },
      {
        Trial: deterministicHoldingTime(1),
        Setup: uniformHoldingTime(2, 4),
        Activated: deterministicHoldingTime(30),
        Churned: deterministicHoldingTime(30),
      },
    );

    const retention = MDP.from({
      states: ["Dormant", "Activated"],
      actions: ["Email", "SalesCall"],
      discount: 0.9,
      transition: {
        Dormant: {
          Email: { Dormant: 0.65, Activated: 0.35 },
          SalesCall: { Dormant: 0.35, Activated: 0.65 },
        },
        Activated: {
          Email: { Activated: 0.9, Dormant: 0.1 },
          SalesCall: { Activated: 0.82, Dormant: 0.18 },
        },
      },
      reward: {
        Dormant: { Email: 1, SalesCall: 4 },
        Activated: { Email: 5, SalesCall: 2 },
      },
    });

    const conversionPosterior = metropolisHastings({
      initial: 0.5,
      rng: new SeededRng(20),
      logTarget: (p) => p <= 0 || p >= 1 ? Number.NEGATIVE_INFINITY : 38 * Math.log(p) + 62 * Math.log(1 - p),
      proposal: (p, rng) => Math.min(0.99, Math.max(0.01, p + rng.normal(0, 0.05))),
    }).run({ iterations: 1_000, burnIn: 200 });

    const absorption = churn.absorptionProbabilities();
    const onboardingEvents = onboarding.simulateUntil(10, "Trial", { rng: new SeededRng(21) });
    const policy = retention.valueIteration().policy;

    expect(sum(Object.values(monthSix))).toBeCloseTo(1);
    expect(absorption.Trial.Expanded).toBeGreaterThan(absorption.Trial.Churned);
    expect(journey.predictNext(["API", "Billing"]).Activated).toBeGreaterThan(0.5);
    expect(onboardingEvents.some((event) => event.state === "Setup")).toBe(true);
    expect(policy.Dormant).toBe("SalesCall");
    expect(conversionPosterior.mean()).toBeGreaterThan(0.3);
    expect(conversionPosterior.mean()).toBeLessThan(0.5);
  });
});
