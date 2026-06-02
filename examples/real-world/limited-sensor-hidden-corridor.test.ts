import { describe, expect, test } from "bun:test";
import { MarkovChain, createObserverWindow, traceSurprise } from "../../index.ts";

describe("real-world example: limited sensor with hidden corridors", () => {
  test("uses a trace to explain observations from a sensor that cannot see maintenance states", () => {
    const plant = createObserverWindow({
      name: "plant-state",
      chain: MarkovChain.from({
        online: { online: 0.7, maintenance: 0.3 },
        maintenance: { online: 0.6, degraded: 0.4 },
        degraded: { online: 0.2, degraded: 0.8 },
      }),
    });

    const comparison = traceSurprise(plant, ["online", "degraded"], ["online", "degraded", "degraded"]);

    expect(comparison.traceSurprise).toBeLessThan(comparison.naiveSurprise);
    expect(comparison.traceWindow.chain.transitionProbability("online", "degraded")).toBeGreaterThan(0);
  });
});
