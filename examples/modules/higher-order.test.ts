import { describe, expect, test } from "bun:test";
import { HigherOrderMarkovModel, SeededRng } from "../../index.ts";

describe("module example: higher-order Markov models", () => {
  test("predicts from the last k states instead of only the current state", () => {
    const model = HigherOrderMarkovModel.fit(
      [["home", "docs", "api", "docs", "api", "pricing"]],
      { order: 2, smoothing: 0.1 },
    );

    const next = model.predictNext(["docs", "api"]);
    const path = model.simulate(["docs", "api"], 2, { rng: new SeededRng(4) });

    expect(next.pricing).toBeGreaterThan(0);
    expect(path).toHaveLength(4);
    expect(model.toFirstOrderChain().states.length).toBeGreaterThan(0);
  });
});
