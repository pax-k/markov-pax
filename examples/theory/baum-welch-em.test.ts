import { describe, expect, test } from "bun:test";
import { baumWelch } from "../../index.ts";

describe("theory example: Baum-Welch EM", () => {
  test("improves hidden Markov model likelihood by re-estimating expected counts", () => {
    const result = baumWelch({
      states: ["Hot", "Cold"],
      observations: ["walk", "shop"],
      sequences: [["walk", "walk", "shop", "shop"]],
      maxIterations: 4,
    });

    expect(result.logLikelihoods.at(-1)!).toBeGreaterThanOrEqual(result.logLikelihoods[0]! - 1e-8);
  });
});
