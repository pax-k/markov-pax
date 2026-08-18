import { expect, test } from "bun:test";
import { ConstrainedMDP, POMDP } from "../../index.ts";

const total = (values: Record<string, number>) => Object.values(values).reduce((sum, value) => sum + value, 0);

test("conflicting synthetic telemetry selects reduced autonomy and human handoff", () => {
  const assuranceBelief = POMDP.from({
    states: ["Assured", "Degraded", "Unsafe"],
    actions: ["CheckTelemetry"],
    observations: ["Consistent", "Conflict"],
    transition: {
      Assured: { CheckTelemetry: { Assured: 0.88, Degraded: 0.1, Unsafe: 0.02 } },
      Degraded: { CheckTelemetry: { Assured: 0.15, Degraded: 0.7, Unsafe: 0.15 } },
      Unsafe: { CheckTelemetry: { Assured: 0.03, Degraded: 0.17, Unsafe: 0.8 } },
    },
    observation: {
      Assured: { CheckTelemetry: { Consistent: 0.94, Conflict: 0.06 } },
      Degraded: { CheckTelemetry: { Consistent: 0.35, Conflict: 0.65 } },
      Unsafe: { CheckTelemetry: { Consistent: 0.08, Conflict: 0.92 } },
    },
  });

  const initial = { Assured: 0.8, Degraded: 0.15, Unsafe: 0.05 };
  const consistent = assuranceBelief.updateBelief({
    belief: initial,
    action: "CheckTelemetry",
    observation: "Consistent",
  });
  const conflictOnce = assuranceBelief.updateBelief({
    belief: initial,
    action: "CheckTelemetry",
    observation: "Conflict",
  });
  const conflictTwice = assuranceBelief.updateBelief({
    belief: conflictOnce,
    action: "CheckTelemetry",
    observation: "Conflict",
  });

  const assurancePolicy = new ConstrainedMDP({
    mdp: {
      states: ["Assured", "Degraded", "Unsafe"],
      actions: ["FullAutonomy", "ReducedAutonomy", "HumanHandoff"],
      discount: 0.85,
      transition: {
        Assured: {
          FullAutonomy: { Assured: 0.92, Degraded: 0.07, Unsafe: 0.01 },
          ReducedAutonomy: { Assured: 0.95, Degraded: 0.05 },
          HumanHandoff: { Assured: 0.97, Degraded: 0.03 },
        },
        Degraded: {
          FullAutonomy: { Assured: 0.1, Degraded: 0.6, Unsafe: 0.3 },
          ReducedAutonomy: { Assured: 0.5, Degraded: 0.45, Unsafe: 0.05 },
          HumanHandoff: { Assured: 0.65, Degraded: 0.33, Unsafe: 0.02 },
        },
        Unsafe: {
          FullAutonomy: { Degraded: 0.2, Unsafe: 0.8 },
          ReducedAutonomy: { Assured: 0.1, Degraded: 0.55, Unsafe: 0.35 },
          HumanHandoff: { Assured: 0.5, Degraded: 0.45, Unsafe: 0.05 },
        },
      },
      reward: {
        Assured: { FullAutonomy: 7, ReducedAutonomy: 4, HumanHandoff: 2 },
        Degraded: { FullAutonomy: -8, ReducedAutonomy: 5, HumanHandoff: 4 },
        Unsafe: { FullAutonomy: -20, ReducedAutonomy: -3, HumanHandoff: 7 },
      },
    },
    costs: {
      Assured: { FullAutonomy: 1, ReducedAutonomy: 2, HumanHandoff: 3 },
      Degraded: { FullAutonomy: 1, ReducedAutonomy: 2, HumanHandoff: 3 },
      Unsafe: { FullAutonomy: 1, ReducedAutonomy: 2, HumanHandoff: 3 },
    },
    budget: 20,
  });
  const policy = assurancePolicy.solve({ start: "Degraded" });

  expect(conflictTwice.Unsafe).toBeGreaterThan(consistent.Unsafe);
  expect(conflictTwice.Unsafe).toBeGreaterThan(conflictOnce.Unsafe);
  expect(total(conflictTwice)).toBeCloseTo(1);
  expect(["ReducedAutonomy", "HumanHandoff"]).toContain(policy.policy.Degraded);
  expect(policy.policy.Unsafe).toBe("HumanHandoff");
  expect(policy.feasible).toBe(true);
});
