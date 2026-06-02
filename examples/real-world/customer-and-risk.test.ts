import { describe, expect, test } from "bun:test";
import {
  AbsorbingChain,
  MarkovChain,
  vectorDistance,
} from "../../index.ts";

function expectClose(actual: number, expected: number, tolerance = 1e-8) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

function sum(values: Iterable<number>) {
  return Array.from(values).reduce((total, value) => total + value, 0);
}

describe("real-world example: SaaS lifecycle forecasting", () => {
  test("forecasts where a cohort of new trial users will be after six months", () => {
    const lifecycle = MarkovChain.from({
      Trial: { Trial: 0.1, Active: 0.55, Dormant: 0.25, Churned: 0.1 },
      Active: { Active: 0.75, Dormant: 0.15, Churned: 0.1 },
      Dormant: { Active: 0.2, Dormant: 0.5, Churned: 0.3 },
      Churned: { Churned: 1 },
    });

    const monthSix = lifecycle.distributionAfter({ Trial: 1 }, 6);

    expectClose(sum(Object.values(monthSix)), 1);
    expect(monthSix.Active).toBeGreaterThan(0.25);
    expect(monthSix.Churned).toBeGreaterThan(monthSix.Dormant);

    const currentMix = { Trial: 0.2, Active: 0.55, Dormant: 0.2, Churned: 0.05 };
    const nextMonth = lifecycle.step(currentMix);
    expect(nextMonth.Active).toBeGreaterThan(currentMix.Active);
    expect(nextMonth.Trial).toBeLessThan(currentMix.Trial);
  });
});

describe("real-world example: credit repayment and default outcomes", () => {
  test("estimates long-run repayment/default probabilities for a borrower cohort", () => {
    const loan = AbsorbingChain.from({
      Current: { Current: 0.72, Delinquent: 0.12, PaidOff: 0.14, Defaulted: 0.02 },
      Delinquent: { Current: 0.25, Delinquent: 0.35, PaidOff: 0.05, Defaulted: 0.35 },
      PaidOff: { PaidOff: 1 },
      Defaulted: { Defaulted: 1 },
    });

    const probabilities = loan.absorptionProbabilities();
    const expectedMonths = loan.expectedTimeToAbsorption();

    expect(probabilities.Current.PaidOff).toBeGreaterThan(probabilities.Current.Defaulted);
    expect(probabilities.Delinquent.Defaulted).toBeGreaterThan(probabilities.Current.Defaulted);
    expectClose(probabilities.Current.PaidOff + probabilities.Current.Defaulted, 1);
    expect(expectedMonths.Current).toBeGreaterThan(expectedMonths.Delinquent);
  });
});

describe("real-world example: retail customer segment drift", () => {
  test("compares campaign impact against the steady-state customer mix", () => {
    const segments = MarkovChain.from({
      Browser: { Browser: 0.45, Buyer: 0.25, Loyal: 0.05, Lost: 0.25 },
      Buyer: { Browser: 0.15, Buyer: 0.45, Loyal: 0.25, Lost: 0.15 },
      Loyal: { Buyer: 0.15, Loyal: 0.75, Lost: 0.1 },
      Lost: { Browser: 0.1, Lost: 0.9 },
    });

    const steadyState = segments.stationary();
    const campaignStart = { Browser: 0.7, Buyer: 0.2, Loyal: 0.1, Lost: 0 };
    const afterYear = segments.distributionAfter(campaignStart, 12);

    expectClose(sum(Object.values(steadyState)), 1);
    expect(afterYear.Loyal).toBeGreaterThan(campaignStart.Loyal);
    expect(vectorDistance(segments.toVector(afterYear), segments.toVector(steadyState))).toBeLessThan(0.35);
  });
});
