import { describe, expect, test } from "bun:test";
import { MarkovChain, restrictedStationaryBelief, traceStationaryDiagnostics } from "../../index.ts";

describe("theory example: stationary belief under tracing", () => {
  test("the trace stationary distribution is the normalized parent stationary restriction", () => {
    const parent = MarkovChain.from({
      red: { green: 0.5, yellow: 0.5 },
      green: { red: 0.5, yellow: 0.5 },
      yellow: { red: 0.75, green: 0.25 },
    });

    const visibleStates = ["red", "green"] as const;
    const restricted = restrictedStationaryBelief(parent, visibleStates);
    const diagnostics = traceStationaryDiagnostics(parent, visibleStates);

    expect(diagnostics.traceStationary.red).toBeCloseTo(restricted.red);
    expect(diagnostics.traceStationary.green).toBeCloseTo(restricted.green);
    expect(diagnostics.l1Distance).toBeLessThan(1e-8);
  });
});
