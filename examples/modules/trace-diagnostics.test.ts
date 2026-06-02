import { describe, expect, test } from "bun:test";
import {
  MarkovChain,
  entropyRate,
  estimateTraceFromPath,
  traceKernelOnParent,
  traceObservationDiagnostics,
  traceStationaryDiagnostics,
} from "../../index.ts";

describe("module example: trace diagnostics", () => {
  test("compares theoretical traces with finite visible samples", () => {
    const machine = MarkovChain.from({
      healthy: { healthy: 0.7, calibration: 0.3 },
      calibration: { healthy: 0.6, warning: 0.4 },
      warning: { healthy: 0.2, warning: 0.8 },
    });

    const visibleStates = ["healthy", "warning"] as const;
    const visibleKernelOnParent = traceKernelOnParent(machine, visibleStates);
    const stationary = traceStationaryDiagnostics(machine, visibleStates);
    const observedLog = ["healthy", "calibration", "warning", "warning", "healthy", "warning"] as const;
    const sampled = estimateTraceFromPath(observedLog, visibleStates, { smoothing: 1 });
    const comparison = traceObservationDiagnostics(machine, visibleStates, observedLog, { smoothing: 1 });

    expect(visibleKernelOnParent.matrix[1]).toEqual([0, 0, 0]);
    expect(stationary.l1Distance).toBeLessThan(1e-8);
    expect(sampled.transitionProbability("healthy", "warning")).toBeGreaterThan(0);
    expect(comparison.visiblePath).toEqual(["healthy", "warning", "warning", "healthy", "warning"]);
    expect(entropyRate(comparison.theoretical)).toBeGreaterThan(0);
  });
});
