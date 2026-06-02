import { describe, expect, test } from "bun:test";
import { MarkovChain, traceChain } from "../../index.ts";

describe("theory example: Markov trace", () => {
  test("computes P_AA + P_AB (I - P_BB)^-1 P_BA for visible states", () => {
    const chain = MarkovChain.from({
      red: { green: 0.5, yellow: 0.5 },
      green: { red: 0.5, yellow: 0.5 },
      yellow: { red: 0.75, green: 0.25 },
    });

    const trace = traceChain(chain, ["red", "green"]);

    expect(trace.transitionProbability("red", "red")).toBeCloseTo(0.375);
    expect(trace.transitionProbability("red", "green")).toBeCloseTo(0.625);
  });
});
