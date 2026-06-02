import { describe, expect, test } from "bun:test";
import {
  AbsorbingChain,
  HiddenMarkovModel,
  MarkovChain,
  SeededRng,
  geometricBrownianMotion,
  metropolisHastings,
  spectralGap,
} from "../../index.ts";

describe("real-world example: credit and market regime risk", () => {
  test("connects asset paths, market regimes, rating migration, default outcomes, and parameter uncertainty", () => {
    const asset = geometricBrownianMotion({ drift: 0.03, volatility: 0.22 });
    const pricePath = asset.simulatePath({ initial: 100, dt: 1 / 252, steps: 20, rng: new SeededRng(70) });

    const regime = HiddenMarkovModel.from({
      states: ["Calm", "Stress"],
      observations: ["small-move", "large-drop"],
      initial: { Calm: 0.85, Stress: 0.15 },
      transition: {
        Calm: { Calm: 0.88, Stress: 0.12 },
        Stress: { Calm: 0.25, Stress: 0.75 },
      },
      emission: {
        Calm: { "small-move": 0.9, "large-drop": 0.1 },
        Stress: { "small-move": 0.35, "large-drop": 0.65 },
      },
    });

    const ratings = MarkovChain.from({
      A: { A: 0.82, BBB: 0.15, Default: 0.03 },
      BBB: { A: 0.08, BBB: 0.72, Default: 0.2 },
      Default: { Default: 1 },
    });

    const workout = AbsorbingChain.from({
      Performing: { Performing: 0.65, Restructured: 0.3, Defaulted: 0.05 },
      Restructured: { Performing: 0.2, Repaid: 0.65, Defaulted: 0.15 },
      Repaid: { Repaid: 1 },
      Defaulted: { Defaulted: 1 },
    });

    const defaultPosterior = metropolisHastings({
      initial: 0.08,
      rng: new SeededRng(71),
      logTarget: (p) => p <= 0 || p >= 1 ? Number.NEGATIVE_INFINITY : 6 * Math.log(p) + 94 * Math.log(1 - p),
      proposal: (p, rng) => Math.min(0.99, Math.max(0.01, p + rng.normal(0, 0.02))),
    }).run({ iterations: 800, burnIn: 100 });

    const stressPosterior = regime.forward(["small-move", "large-drop", "large-drop"]).posterior;
    const oneYearRatings = ratings.distributionAfter({ A: 1 }, 12);
    const absorption = workout.absorptionProbabilities();

    expect(pricePath.every((point) => point.value > 0)).toBe(true);
    expect(stressPosterior.Stress).toBeGreaterThan(stressPosterior.Calm);
    expect(oneYearRatings.Default).toBeGreaterThan(0);
    expect(absorption.Performing.Repaid).toBeGreaterThan(absorption.Performing.Defaulted);
    expect(spectralGap(ratings.matrix)).toBeGreaterThan(0);
    expect(defaultPosterior.mean()).toBeLessThan(0.12);
  });
});
