import { describe, expect, test } from "bun:test";
import { MarkovChain, naiveRestriction, traceChain } from "../../index.ts";

describe("module example: trace chains", () => {
  test("computes what a limited observer sees after hidden excursions", () => {
    const parent = MarkovChain.from({
      red: { green: 0.5, yellow: 0.5 },
      green: { red: 0.5, yellow: 0.5 },
      yellow: { red: 0.75, green: 0.25 },
    });

    const visible = traceChain(parent, ["red", "green"]);
    const naive = naiveRestriction(parent, ["red", "green"]);

    expect(visible.transitionProbability("red", "red")).toBeCloseTo(0.375);
    expect(visible.transitionProbability("red", "green")).not.toBeCloseTo(naive.transitionProbability("red", "green"));
  });
});
