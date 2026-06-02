import { describe, expect, test } from "bun:test";
import {
  BayesianNetwork,
  CTMC,
  MDP,
  MM1Queue,
  POMDP,
  SeededRng,
  SemiMarkovProcess,
  deterministicHoldingTime,
  exponentialHoldingTime,
} from "../../index.ts";

const key = (values: readonly string[]) => JSON.stringify(values);

function sum(values: Iterable<number>) {
  return Array.from(values).reduce((total, value) => total + value, 0);
}

describe("real-world example: hospital capacity and treatment policy", () => {
  test("combines patient flow, triage beliefs, queue pressure, and escalation decisions", () => {
    const patientFlow = SemiMarkovProcess.from(
      { ER: { Ward: 0.75, ICU: 0.25 }, Ward: { Discharged: 0.85, ICU: 0.15 }, ICU: { Ward: 0.6, Discharged: 0.4 }, Discharged: { Discharged: 1 } },
      {
        ER: exponentialHoldingTime(1 / 4),
        Ward: deterministicHoldingTime(36),
        ICU: deterministicHoldingTime(48),
        Discharged: deterministicHoldingTime(1),
      },
    );

    const bedStatus = CTMC.fromGenerator({
      Available: { Available: -0.35, Occupied: 0.35 },
      Occupied: { Available: 0.5, Occupied: -0.5 },
    });

    const triage = POMDP.from({
      states: ["Stable", "Critical"],
      actions: ["Observe"],
      observations: ["normal", "shock"],
      transition: {
        Stable: { Observe: { Stable: 0.85, Critical: 0.15 } },
        Critical: { Observe: { Stable: 0.2, Critical: 0.8 } },
      },
      observation: {
        Stable: { Observe: { normal: 0.9, shock: 0.1 } },
        Critical: { Observe: { normal: 0.2, shock: 0.8 } },
      },
    });

    const diagnosis = new BayesianNetwork({
      variables: ["Sepsis", "Lactate"],
      domains: { Sepsis: ["yes", "no"], Lactate: ["high", "normal"] },
      parents: { Sepsis: [], Lactate: ["Sepsis"] },
      cpt: {
        Sepsis: { [key([])]: { yes: 0.12, no: 0.88 } },
        Lactate: {
          [key(["yes"])]: { high: 0.8, normal: 0.2 },
          [key(["no"])]: { high: 0.15, normal: 0.85 },
        },
      },
    });

    const treatment = MDP.from({
      states: ["Stable", "Critical"],
      actions: ["Monitor", "Escalate"],
      discount: 0.9,
      transition: {
        Stable: {
          Monitor: { Stable: 0.9, Critical: 0.1 },
          Escalate: { Stable: 0.95, Critical: 0.05 },
        },
        Critical: {
          Monitor: { Critical: 0.75, Stable: 0.25 },
          Escalate: { Critical: 0.35, Stable: 0.65 },
        },
      },
      reward: {
        Stable: { Monitor: 4, Escalate: 2 },
        Critical: { Monitor: -6, Escalate: 3 },
      },
    });

    const erQueue = new MM1Queue({ arrivalRate: 8, serviceRate: 10 });
    const flowEvents = patientFlow.simulateUntil(72, "ER", { rng: new SeededRng(30) });
    const bedStationary = bedStatus.stationary();
    const beliefAfterShock = triage.updateBelief({ belief: { Stable: 0.8, Critical: 0.2 }, action: "Observe", observation: "shock" });
    const sepsisAfterHighLactate = diagnosis.query("Sepsis", { Lactate: "high" });
    const policy = treatment.valueIteration().policy;

    expect(flowEvents.some((event) => event.state === "ER")).toBe(true);
    expect(bedStationary.Available).toBeGreaterThan(0.5);
    expect(sum(Object.values(beliefAfterShock))).toBeCloseTo(1);
    expect(beliefAfterShock.Critical).toBeGreaterThan(0.5);
    expect(sepsisAfterHighLactate.yes).toBeGreaterThan(0.12);
    expect(policy.Critical).toBe("Escalate");
    expect(erQueue.expectedNumberInSystem()).toBeGreaterThan(3);
  });
});
