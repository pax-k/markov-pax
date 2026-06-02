import { describe, expect, test } from "bun:test";
import {
  HiddenMarkovModel,
  MDP,
  MarkovChain,
  createWorkflow,
} from "../../index.ts";

describe("module example: high-level workflow API", () => {
  test("runs observations -> infer -> forecast -> recommend -> simulate -> estimate uncertainty", () => {
    const intent = HiddenMarkovModel.from({
      states: ["Browsing", "Buying"],
      observations: ["page", "checkout"],
      initial: { Browsing: 0.8, Buying: 0.2 },
      transition: {
        Browsing: { Browsing: 0.75, Buying: 0.25 },
        Buying: { Browsing: 0.2, Buying: 0.8 },
      },
      emission: {
        Browsing: { page: 0.9, checkout: 0.1 },
        Buying: { page: 0.25, checkout: 0.75 },
      },
    });
    const lifecycle = MarkovChain.from({
      Browsing: { Browsing: 0.5, Buying: 0.4, Left: 0.1 },
      Buying: { Buying: 0.7, Left: 0.3 },
      Left: { Left: 1 },
    });
    const offerPolicy = MDP.from({
      states: ["Browsing", "Buying"],
      actions: ["ShowOffer", "DoNothing"],
      discount: 0.8,
      transition: {
        Browsing: {
          ShowOffer: { Buying: 0.65, Browsing: 0.35 },
          DoNothing: { Buying: 0.25, Browsing: 0.75 },
        },
        Buying: {
          ShowOffer: { Buying: 0.85, Browsing: 0.15 },
          DoNothing: { Buying: 0.9, Browsing: 0.1 },
        },
      },
      reward: {
        Browsing: { ShowOffer: 3, DoNothing: 1 },
        Buying: { ShowOffer: 2, DoNothing: 4 },
      },
    });

    const result = createWorkflow({ name: "commerce assistant" })
      .withInference({ kind: "hmm", model: intent, observations: ["page", "checkout", "checkout"] })
      .withForecast({ kind: "markov", model: lifecycle, distribution: { Browsing: 1 }, steps: 2 })
      .withDecision({ model: offerPolicy, state: "Browsing" })
      .withSimulation({ kind: "markov", model: lifecycle, start: "Browsing", steps: 3, seed: 4 })
      .withUncertainty({
        parameter: "conversionRate",
        initial: 0.3,
        logTarget: (p) => p > 0 && p < 1 ? -((p - 0.45) ** 2) / 0.02 : Number.NEGATIVE_INFINITY,
        iterations: 60,
        burnIn: 10,
        seed: 6,
      })
      .run();

    expect(result.inferredState).toBe("Buying");
    expect(result.recommendedAction).toBe("ShowOffer");
    expect(result.simulatedPath).toHaveLength(4);
    expect(result.uncertainty!.conversionRate!.acceptanceRate).toBeGreaterThan(0.2);
    expect(result.details.inference).toBeDefined();
  });
});
