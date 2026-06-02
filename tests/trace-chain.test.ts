import { describe, expect, test } from "bun:test";
import {
  EnhancedMarkovChain,
  MarkovChain,
  SeededRng,
  counterDilation,
  determinantInvariant,
  entropyRate,
  estimateTraceFromPath,
  expectedVisibleReturnTime,
  naiveRestriction,
  restrictedStationaryBelief,
  simulateTrace,
  traceChain,
  traceDynamicsInvariants,
  traceKernelOnParent,
  traceObservationDiagnostics,
  traceStationaryDiagnostics,
} from "../index.ts";

function sum(values: Iterable<number>) {
  return Array.from(values).reduce((total, value) => total + value, 0);
}

describe("finite Markov traces and enhanced counters", () => {
  test("computes the induced red/green trace through hidden yellow states", () => {
    const parent = MarkovChain.from({
      red: { green: 0.5, yellow: 0.5 },
      green: { red: 0.5, yellow: 0.5 },
      yellow: { red: 0.75, green: 0.25 },
    });

    const traced = traceChain(parent, ["red", "green"]);
    const naive = naiveRestriction(parent, ["red", "green"]);

    expect(traced.states).toEqual(["red", "green"]);
    expect(sum(traced.matrix[0]!)).toBeCloseTo(1);
    expect(traced.transitionProbability("red", "red")).toBeCloseTo(0.375);
    expect(traced.transitionProbability("red", "green")).toBeCloseTo(0.625);
    expect(naive.transitionProbability("red", "green")).toBeCloseTo(1);
    expect(traced.transitionProbability("red", "green")).not.toBeCloseTo(naive.transitionProbability("red", "green"));

    const allVisible = traceChain(parent, ["red", "green", "yellow"]);
    expect(allVisible.transitionProbability("yellow", "red")).toBeCloseTo(0.75);
  });

  test("represents trace kernels on parent support and maps stationary beliefs by restriction", () => {
    const parent = MarkovChain.from({
      red: { green: 0.5, yellow: 0.5 },
      green: { red: 0.5, yellow: 0.5 },
      yellow: { red: 0.75, green: 0.25 },
    });

    const kernel = traceKernelOnParent(parent, ["red", "green"]);
    expect(kernel.parentStates).toEqual(["red", "green", "yellow"]);
    expect(kernel.support).toEqual(["red", "green"]);
    expect(sum(kernel.matrix[0]!)).toBeCloseTo(1);
    expect(sum(kernel.matrix[1]!)).toBeCloseTo(1);
    expect(kernel.matrix[2]).toEqual([0, 0, 0]);

    const restricted = restrictedStationaryBelief(parent, ["red", "green"]);
    const diagnostics = traceStationaryDiagnostics(parent, ["red", "green"]);
    expect(restricted.red).toBeCloseTo(diagnostics.traceStationary.red);
    expect(restricted.green).toBeCloseTo(diagnostics.traceStationary.green);
    expect(diagnostics.l1Distance).toBeLessThan(1e-8);
  });

  test("estimates visible trace dynamics from finite observed paths", () => {
    const parent = MarkovChain.from({
      red: { green: 0.5, yellow: 0.5 },
      green: { red: 0.5, yellow: 0.5 },
      yellow: { red: 0.75, green: 0.25 },
    });
    const path = ["red", "yellow", "green", "yellow", "red", "green", "yellow", "red"] as const;

    const empirical = estimateTraceFromPath(path, ["red", "green"], { smoothing: 1 });
    expect(empirical.states).toEqual(["red", "green"]);
    expect(sum(empirical.matrix[0]!)).toBeCloseTo(1);
    expect(sum(empirical.matrix[1]!)).toBeCloseTo(1);

    const diagnostics = traceObservationDiagnostics(parent, ["red", "green"], path, { smoothing: 1 });
    expect(diagnostics.visiblePath).toEqual(["red", "green", "red", "green", "red"]);
    expect(diagnostics.theoretical.transitionProbability("red", "green")).toBeCloseTo(0.625);
    expect(Number.isFinite(diagnostics.l1Distance)).toBe(true);
  });

  test("simulates visible traces and compares full versus visible counters", () => {
    const parent = MarkovChain.from({
      red: { yellow: 1 },
      yellow: { green: 1 },
      green: { red: 1 },
    });
    const enhanced = new EnhancedMarkovChain(parent, { counterName: "experience-updates" });

    expect(enhanced.counterName).toBe("experience-updates");
    expect(enhanced.simulate("red", 2).counter).toBe(2);
    expect(enhanced.trace(["red", "green"]).transitionProbability("red", "green")).toBe(1);

    const simulated = simulateTrace(parent, "red", ["red", "green"], {
      visibleSteps: 2,
      rng: new SeededRng(7),
    });
    expect(simulated.visiblePath).toEqual(["red", "green", "red"]);
    expect(simulated.fullTicks).toBe(3);
    expect(simulated.visibleTicks).toBe(2);
    expect(simulated.hiddenTicks).toBe(1);
    expect(simulated.dilationRatio).toBeLessThan(1);

    const counters = counterDilation(simulated.fullPath, ["red", "green"]);
    expect(counters).toEqual({
      fullTicks: 3,
      visibleTicks: 2,
      hiddenTicks: 1,
      dilationRatio: 2 / 3,
    });
  });

  test("computes expected visible return times", () => {
    const parent = MarkovChain.from({
      red: { yellow: 1 },
      yellow: { green: 1 },
      green: { red: 1 },
    });

    const returnTimes = expectedVisibleReturnTime(parent, ["red", "green"]);
    expect(returnTimes.red).toBeCloseTo(2);
    expect(returnTimes.green).toBeCloseTo(1);

    const allVisible = expectedVisibleReturnTime(parent, ["red", "yellow", "green"]);
    expect(allVisible.yellow).toBe(1);
  });

  test("computes entropy-rate and determinant dynamics diagnostics", () => {
    const deterministic = MarkovChain.from({
      left: { right: 1 },
      right: { left: 1 },
    });
    expect(entropyRate(deterministic)).toBeCloseTo(0);
    expect(determinantInvariant(deterministic)).toBeCloseTo(-1);

    const noisy = MarkovChain.from({
      left: { left: 0.8, right: 0.2 },
      right: { left: 0.4, right: 0.6 },
    });
    const invariants = traceDynamicsInvariants(noisy);
    expect(invariants.entropyRate).toBeGreaterThan(0);
    expect(invariants.determinant).toBeCloseTo(0.4);

    const singular = MarkovChain.from({
      left: { left: 0.5, right: 0.5 },
      right: { left: 0.5, right: 0.5 },
    });
    expect(determinantInvariant(singular)).toBe(0);
  });

  test("rejects invalid traces, restrictions, simulations, and counters", () => {
    const trap = MarkovChain.from({
      red: { yellow: 1 },
      green: { red: 1 },
      yellow: { yellow: 1 },
    });
    expect(() => traceChain(trap, ["red", "green"])).toThrow(/hidden states/i);

    const noVisibleMass = MarkovChain.from({
      red: { yellow: 1 },
      yellow: { red: 1 },
    });
    expect(() => naiveRestriction(noVisibleMass, ["red"])).toThrow(/visible probability/i);
    expect(() => traceChain(noVisibleMass, [])).toThrow(/at least one/i);
    expect(() => traceChain(noVisibleMass, ["missing" as "red"])).toThrow(/unknown visible/i);
    expect(() => traceChain(noVisibleMass, ["red", "red"])).toThrow(/duplicate/i);

    expect(() => simulateTrace(noVisibleMass, "red", ["red"], { visibleSteps: -1 })).toThrow(/visibleSteps/i);
    expect(() => simulateTrace(noVisibleMass, "red", ["red"], { visibleSteps: 2, maxFullSteps: 1 })).toThrow(/maxFullSteps/i);
    expect(() => simulateTrace(noVisibleMass, "missing" as "red", ["red"], { visibleSteps: 1 })).toThrow(/Unknown start/i);
    expect(() => simulateTrace(noVisibleMass, "red", ["red"], { visibleSteps: 2, maxFullSteps: 2 })).toThrow(/enough visible/i);
    expect(() => counterDilation([], ["red"])).toThrow(/fullPath/i);
    expect(() => counterDilation(["red"], [])).toThrow(/visibleStates/i);

    const zeroVisibleStationaryMass = MarkovChain.from({
      hidden: { hidden: 1 },
      visible: { hidden: 1 },
    });
    expect(() => restrictedStationaryBelief(zeroVisibleStationaryMass, ["visible"])).toThrow(/positive visible/i);

    expect(() => estimateTraceFromPath([], ["red"])).toThrow(/path/i);
    expect(() => estimateTraceFromPath(["yellow"], ["red"])).toThrow(/visible transition/i);
    expect(() => estimateTraceFromPath(["red", "green"], [])).toThrow(/at least one/i);
    expect(() => estimateTraceFromPath(["red", "green"], ["red", "green"], { smoothing: -1 })).toThrow(/smoothing/i);
    expect(() => estimateTraceFromPath(["red", "green"], ["red", "green"])).toThrow(/outgoing observed/i);
  });
});
