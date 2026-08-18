import { expect, test } from "bun:test";
import { ConstrainedMDP, POMDP } from "../../index.ts";

const total = (values: Record<string, number>) => Object.values(values).reduce((sum, value) => sum + value, 0);

test("synthetic interference evidence selects a resilient communications mode", () => {
  const regimeEvidence = POMDP.from({
    states: ["ClearRegime", "DegradedRegime"],
    actions: ["ObserveLink"],
    observations: ["StableSignal", "InterferencePattern"],
    transition: {
      ClearRegime: { ObserveLink: { ClearRegime: 0.88, DegradedRegime: 0.12 } },
      DegradedRegime: { ObserveLink: { ClearRegime: 0.2, DegradedRegime: 0.8 } },
    },
    observation: {
      ClearRegime: { ObserveLink: { StableSignal: 0.9, InterferencePattern: 0.1 } },
      DegradedRegime: { ObserveLink: { StableSignal: 0.2, InterferencePattern: 0.8 } },
    },
  });
  const prior = { ClearRegime: 0.75, DegradedRegime: 0.25 };
  const stableBelief = regimeEvidence.updateBelief({
    belief: prior,
    action: "ObserveLink",
    observation: "StableSignal",
  });
  const interferenceBelief = regimeEvidence.updateBelief({
    belief: prior,
    action: "ObserveLink",
    observation: "InterferencePattern",
  });

  const modePolicy = new ConstrainedMDP({
    mdp: {
      states: ["ClearRegime", "DegradedRegime"],
      actions: ["StandardMode", "ResilientMode", "HumanCoordination"],
      discount: 0.85,
      transition: {
        ClearRegime: {
          StandardMode: { ClearRegime: 0.92, DegradedRegime: 0.08 },
          ResilientMode: { ClearRegime: 0.95, DegradedRegime: 0.05 },
          HumanCoordination: { ClearRegime: 0.97, DegradedRegime: 0.03 },
        },
        DegradedRegime: {
          StandardMode: { ClearRegime: 0.15, DegradedRegime: 0.85 },
          ResilientMode: { ClearRegime: 0.7, DegradedRegime: 0.3 },
          HumanCoordination: { ClearRegime: 0.75, DegradedRegime: 0.25 },
        },
      },
      reward: {
        ClearRegime: { StandardMode: 6, ResilientMode: 3, HumanCoordination: 1 },
        DegradedRegime: { StandardMode: -8, ResilientMode: 6, HumanCoordination: 4 },
      },
    },
    costs: {
      ClearRegime: { StandardMode: 1, ResilientMode: 2, HumanCoordination: 3 },
      DegradedRegime: { StandardMode: 1, ResilientMode: 2, HumanCoordination: 3 },
    },
    budget: 20,
  });
  const policy = modePolicy.solve({ start: "DegradedRegime" });

  expect(interferenceBelief.DegradedRegime).toBeGreaterThan(stableBelief.DegradedRegime);
  expect(total(interferenceBelief)).toBeCloseTo(1);
  expect(policy.policy.DegradedRegime).toBe("ResilientMode");
  expect(policy.feasible).toBe(true);
});
