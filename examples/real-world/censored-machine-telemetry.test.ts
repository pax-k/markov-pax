import { describe, expect, test } from "bun:test";
import {
  MarkovChain,
  entropyRate,
  traceObservationDiagnostics,
  traceStationaryDiagnostics,
  traceSurprise,
  createObserverWindow,
} from "../../index.ts";

describe("real-world example: censored machine telemetry", () => {
  test("audits a visible machine log when calibration states are hidden from the sensor", () => {
    const plantChain = MarkovChain.from({
      online: { online: 0.72, calibration: 0.18, degraded: 0.1 },
      calibration: { online: 0.55, degraded: 0.45 },
      degraded: { online: 0.18, calibration: 0.12, degraded: 0.7 },
    });
    const plant = createObserverWindow({ name: "plant", chain: plantChain });
    const sensorStates = ["online", "degraded"] as const;
    const observedLog = ["online", "calibration", "degraded", "degraded", "calibration", "online", "degraded"] as const;

    const finiteSample = traceObservationDiagnostics(plantChain, sensorStates, observedLog, { smoothing: 1 });
    const longRunSensorBelief = traceStationaryDiagnostics(plantChain, sensorStates);
    const surprise = traceSurprise(plant, sensorStates, ["online", "degraded", "degraded"]);

    expect(finiteSample.visiblePath).toEqual(["online", "degraded", "degraded", "online", "degraded"]);
    expect(longRunSensorBelief.l1Distance).toBeLessThan(1e-8);
    expect(surprise.traceSurprise).toBeLessThan(surprise.naiveSurprise);
    expect(entropyRate(finiteSample.theoretical)).toBeGreaterThan(0);
  });
});
