import { describe, expect, test } from "bun:test";
import {
  HiddenMarkovModel,
  HigherOrderMarkovModel,
  MDP,
  RandomWalkGraph,
  SeededRng,
  pagerank,
} from "../../index.ts";

describe("real-world example: search and recommendation quality", () => {
  test("combines authority ranking, intent inference, journey prediction, and recommendation choice", () => {
    const docs: Record<string, readonly string[]> = {
      Home: ["Guide", "API", "Pricing"],
      Guide: ["API", "Tutorial"],
      API: ["Guide", "Reference", "Billing"],
      Tutorial: ["API"],
      Reference: ["API"],
      Pricing: ["Billing"],
      Billing: ["API"],
    };
    const graph = RandomWalkGraph.from(docs);
    const ranks = pagerank(docs);

    const journeys = HigherOrderMarkovModel.fit(
      [
        ["Home", "Guide", "API", "Reference"],
        ["Home", "Guide", "Tutorial", "API"],
        ["Home", "Pricing", "Billing", "API"],
      ],
      { order: 2, smoothing: 0.1 },
    );

    const intent = HiddenMarkovModel.from({
      states: ["Learning", "Integrating", "Buying"],
      observations: ["guide-click", "api-click", "billing-click"],
      initial: { Learning: 0.6, Integrating: 0.3, Buying: 0.1 },
      transition: {
        Learning: { Learning: 0.65, Integrating: 0.3, Buying: 0.05 },
        Integrating: { Learning: 0.1, Integrating: 0.75, Buying: 0.15 },
        Buying: { Integrating: 0.2, Buying: 0.8 },
      },
      emission: {
        Learning: { "guide-click": 0.7, "api-click": 0.25, "billing-click": 0.05 },
        Integrating: { "guide-click": 0.15, "api-click": 0.7, "billing-click": 0.15 },
        Buying: { "guide-click": 0.05, "api-click": 0.25, "billing-click": 0.7 },
      },
    });

    const recommender = MDP.from({
      states: ["Learning", "Integrating", "Buying"],
      actions: ["ShowGuide", "ShowAPI", "ShowBilling"],
      discount: 0.8,
      transition: {
        Learning: {
          ShowGuide: { Learning: 0.5, Integrating: 0.45, Buying: 0.05 },
          ShowAPI: { Learning: 0.25, Integrating: 0.65, Buying: 0.1 },
          ShowBilling: { Learning: 0.55, Buying: 0.45 },
        },
        Integrating: {
          ShowGuide: { Learning: 0.3, Integrating: 0.6, Buying: 0.1 },
          ShowAPI: { Integrating: 0.6, Buying: 0.4 },
          ShowBilling: { Integrating: 0.35, Buying: 0.65 },
        },
        Buying: {
          ShowGuide: { Buying: 0.5, Integrating: 0.5 },
          ShowAPI: { Buying: 0.6, Integrating: 0.4 },
          ShowBilling: { Buying: 0.9, Integrating: 0.1 },
        },
      },
      reward: {
        Learning: { ShowGuide: 4, ShowAPI: 3, ShowBilling: 0 },
        Integrating: { ShowGuide: 1, ShowAPI: 5, ShowBilling: 2 },
        Buying: { ShowGuide: -1, ShowAPI: 2, ShowBilling: 5 },
      },
    });

    const path = graph.walk("Home", 4, { rng: new SeededRng(60) });
    const inferredIntent = intent.viterbi(["guide-click", "api-click", "billing-click", "billing-click"]).path.at(-1);
    const nextAfterApi = journeys.predictNext(["Guide", "API"]);
    const policy = recommender.valueIteration().policy;

    expect(path).toHaveLength(5);
    expect(ranks.API!).toBeGreaterThan(ranks.Pricing!);
    expect(inferredIntent).toBe("Buying");
    expect(nextAfterApi.Reference).toBeGreaterThan(0);
    expect(policy.Buying).toBe("ShowBilling");
  });
});
