import { describe, expect, test } from "bun:test";
import { MarkovChain, counterDilation, traceChain } from "../../index.ts";

describe("real-world example: apparent jump through hidden states", () => {
  test("models an apparent jump as a finite hidden-corridor toy model, not a physics derivation", () => {
    const corridor = MarkovChain.from({
      left: { tunnel1: 1 },
      tunnel1: { tunnel2: 1 },
      tunnel2: { right: 1 },
      right: { left: 1 },
    });

    const visibleTrace = traceChain(corridor, ["left", "right"]);
    const counters = counterDilation(["left", "tunnel1", "tunnel2", "right"], ["left", "right"]);

    expect(visibleTrace.transitionProbability("left", "right")).toBe(1);
    expect(counters.fullTicks).toBe(3);
    expect(counters.visibleTicks).toBe(1);
  });
});
