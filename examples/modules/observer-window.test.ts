import { describe, expect, test } from "bun:test";
import { MarkovChain, createObserverWindow, sequenceLogLikelihood, traceToWindow } from "../../index.ts";

describe("module example: observer windows", () => {
  test("wraps a Markov chain as a named observer window with a stationary belief", () => {
    const parent = createObserverWindow({
      name: "traffic-light",
      chain: MarkovChain.from({
        red: { green: 0.5, yellow: 0.5 },
        green: { red: 0.5, yellow: 0.5 },
        yellow: { red: 0.75, green: 0.25 },
      }),
    });

    const glasses = traceToWindow(parent, ["red", "green"], { name: "red-green glasses" });

    expect(glasses.parent).toBe(parent);
    expect(glasses.stationaryBelief().red).toBeGreaterThan(0);
    expect(sequenceLogLikelihood(glasses, ["red", "green", "red"])).toBeLessThan(0);
  });
});
