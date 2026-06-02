import { describe, expect, test } from "bun:test";
import { MarkovChain, counterDilation } from "../../index.ts";

describe("theory example: enhanced counters in traces", () => {
  test("counts fewer visible ticks when hidden states occur between visible observations", () => {
    const chain = MarkovChain.from({
      red: { yellow: 1 },
      yellow: { green: 1 },
      green: { red: 1 },
    });
    const fullPath = chain.simulate("red", 3);

    const counters = counterDilation(fullPath, ["red", "green"]);

    expect(counters.fullTicks).toBe(3);
    expect(counters.visibleTicks).toBe(2);
    expect(counters.dilationRatio).toBeCloseTo(2 / 3);
  });
});
