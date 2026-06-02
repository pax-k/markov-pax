import { describe, expect, test } from "bun:test";
import { baumWelch, supervisedHMMFit } from "../../index.ts";

describe("module example: HMM learning", () => {
  test("learns HMM parameters from labeled or unlabeled sequences", () => {
    const labeled = supervisedHMMFit({
      states: ["Good", "Bad"],
      observations: ["ok", "alert"],
      smoothing: 0.1,
      sequences: [{ states: ["Good", "Good", "Bad"], observations: ["ok", "ok", "alert"] }],
    });

    const unlabeled = baumWelch({
      states: ["Good", "Bad"],
      observations: ["ok", "alert"],
      sequences: [["ok", "ok", "alert", "alert"]],
      maxIterations: 3,
    });

    expect(labeled.sequenceProbability(["ok", "alert"])).toBeGreaterThan(0);
    expect(unlabeled.logLikelihoods.length).toBeGreaterThan(0);
  });
});
