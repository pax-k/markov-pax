import { expect, test } from "bun:test";
import { AbsorbingChain, HiddenMarkovModel, MDP } from "../../index.ts";

test("synthetic defensive telemetry selects containment before impact", () => {
  const stageEvidence = HiddenMarkovModel.from({
    states: ["Routine", "Suspected", "Established"],
    observations: ["Normal", "Anomaly", "CorrelatedAlert"],
    initial: { Routine: 0.9, Suspected: 0.08, Established: 0.02 },
    transition: {
      Routine: { Routine: 0.9, Suspected: 0.09, Established: 0.01 },
      Suspected: { Routine: 0.15, Suspected: 0.65, Established: 0.2 },
      Established: { Routine: 0.03, Suspected: 0.17, Established: 0.8 },
    },
    emission: {
      Routine: { Normal: 0.9, Anomaly: 0.08, CorrelatedAlert: 0.02 },
      Suspected: { Normal: 0.2, Anomaly: 0.55, CorrelatedAlert: 0.25 },
      Established: { Normal: 0.05, Anomaly: 0.25, CorrelatedAlert: 0.7 },
    },
  });
  const routineBelief = stageEvidence.forward(["Normal", "Normal"]).posterior;
  const alertBelief = stageEvidence.forward(["Anomaly", "CorrelatedAlert"]).posterior;

  const outcomeChain = AbsorbingChain.from({
    Detected: { Contained: 0.65, Escalating: 0.25, Impact: 0.1 },
    Escalating: { Contained: 0.55, Escalating: 0.2, Impact: 0.25 },
    Contained: { Contained: 1 },
    Impact: { Impact: 1 },
  });
  const outcomes = outcomeChain.absorptionProbabilities();

  const response = MDP.from({
    states: ["Routine", "Suspected", "Established"],
    actions: ["Monitor", "Isolate", "HumanApprovedContainment"],
    discount: 0.9,
    transition: {
      Routine: {
        Monitor: { Routine: 0.94, Suspected: 0.05, Established: 0.01 },
        Isolate: { Routine: 0.98, Suspected: 0.02 },
        HumanApprovedContainment: { Routine: 0.99, Suspected: 0.01 },
      },
      Suspected: {
        Monitor: { Routine: 0.15, Suspected: 0.6, Established: 0.25 },
        Isolate: { Routine: 0.7, Suspected: 0.25, Established: 0.05 },
        HumanApprovedContainment: { Routine: 0.75, Suspected: 0.23, Established: 0.02 },
      },
      Established: {
        Monitor: { Suspected: 0.15, Established: 0.85 },
        Isolate: { Routine: 0.45, Suspected: 0.45, Established: 0.1 },
        HumanApprovedContainment: { Routine: 0.65, Suspected: 0.32, Established: 0.03 },
      },
    },
    reward: {
      Routine: { Monitor: 5, Isolate: 1, HumanApprovedContainment: 0 },
      Suspected: { Monitor: -5, Isolate: 5, HumanApprovedContainment: 4 },
      Established: { Monitor: -12, Isolate: 5, HumanApprovedContainment: 7 },
    },
  });
  const policy = response.valueIteration().policy;

  expect(alertBelief.Established).toBeGreaterThan(routineBelief.Established);
  expect(outcomes.Detected.Contained).toBeGreaterThan(outcomes.Detected.Impact);
  expect(["Isolate", "HumanApprovedContainment"]).toContain(policy.Suspected);
  expect(["Isolate", "HumanApprovedContainment"]).toContain(policy.Established);
});
