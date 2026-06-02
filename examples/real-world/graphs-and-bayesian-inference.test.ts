import { describe, expect, test } from "bun:test";
import {
  RandomWalkGraph,
  SeededRng,
  metropolisHastings,
  pagerank,
} from "../../index.ts";

function expectClose(actual: number, expected: number, tolerance = 1e-8) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

function sigmoid(value: number) {
  return 1 / (1 + Math.exp(-value));
}

function sum(values: Iterable<number>) {
  return Array.from(values).reduce((total, value) => total + value, 0);
}

describe("real-world example: documentation search ranking", () => {
  test("ranks high-value documentation pages from internal link structure", () => {
    const ranks = pagerank<"Home" | "Guide" | "API" | "Tutorial" | "Changelog">({
      Home: ["Guide", "API"],
      Guide: ["API", "Tutorial"],
      API: ["Guide"],
      Tutorial: ["Guide"],
      Changelog: ["Home"],
    });

    expectClose(sum(Object.values(ranks)), 1);
    expect(ranks.Guide).toBeGreaterThan(ranks.Home);
    expect(ranks.API).toBeGreaterThan(ranks.Changelog);
  });
});

describe("real-world example: user navigation simulation on a help center", () => {
  test("simulates a reproducible visitor path through support articles", () => {
    const helpCenter = RandomWalkGraph.from({
      Landing: ["Install", "Troubleshooting"],
      Install: ["CLI", "Troubleshooting"],
      CLI: ["Troubleshooting"],
      Troubleshooting: ["Contact"],
      Contact: ["Landing"],
    });

    const path = helpCenter.walk("Landing", 5, { rng: new SeededRng(7) });
    const allowedNodes = new Set(helpCenter.nodes);

    expect(path).toHaveLength(6);
    expect(path[0]).toBe("Landing");
    expect(path.every((node) => allowedNodes.has(node))).toBe(true);
    expect(path.includes("Troubleshooting")).toBe(true);
  });
});

describe("real-world example: Bayesian conversion-rate estimation", () => {
  test("uses MCMC to estimate a campaign conversion rate from observed trials", () => {
    const successes = 42;
    const trials = 100;
    const failures = trials - successes;
    const alphaPrior = 1;
    const betaPrior = 1;

    const sampler = metropolisHastings({
      initial: 0,
      rng: new SeededRng(2026),
      proposal: (current: number, rng) => current + rng.normal(0, 0.35),
      logTarget: (logitConversionRate: number) => {
        const p = sigmoid(logitConversionRate);
        const betaLogDensity =
          (successes + alphaPrior - 1) * Math.log(p) +
          (failures + betaPrior - 1) * Math.log(1 - p);

        return betaLogDensity + Math.log(p) + Math.log(1 - p);
      },
    });

    const result = sampler.run({ iterations: 8_000, burnIn: 1_000, thin: 2 });
    const estimatedConversionRate =
      result.samples.reduce((total, logit) => total + sigmoid(logit), 0) / result.samples.length;
    const closedFormPosteriorMean = (successes + alphaPrior) / (trials + alphaPrior + betaPrior);

    expect(result.samples).toHaveLength(3_500);
    expect(result.acceptanceRate).toBeGreaterThan(0.35);
    expect(result.acceptanceRate).toBeLessThan(0.95);
    expectClose(estimatedConversionRate, closedFormPosteriorMean, 0.03);
  });
});
