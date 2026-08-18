import { expect, test } from "bun:test";
import {
  CTMC,
  ConstrainedMDP,
  HiddenMarkovModel,
  SeededRng,
  SemiMarkovProcess,
  deterministicHoldingTime,
  uniformHoldingTime,
} from "../../index.ts";

test("synthetic asset warnings support a feasible maintenance policy", () => {
  const healthEvidence = HiddenMarkovModel.from({
    states: ["Ready", "Degraded"],
    observations: ["Normal", "Warning"],
    initial: { Ready: 0.85, Degraded: 0.15 },
    transition: {
      Ready: { Ready: 0.9, Degraded: 0.1 },
      Degraded: { Ready: 0.25, Degraded: 0.75 },
    },
    emission: {
      Ready: { Normal: 0.9, Warning: 0.1 },
      Degraded: { Normal: 0.25, Warning: 0.75 },
    },
  });

  const availability = CTMC.fromGenerator({
    Ready: { Ready: -0.08, Degraded: 0.08 },
    Degraded: { Ready: 0.32, Degraded: -0.32 },
  });

  const readinessCycle = SemiMarkovProcess.from(
    {
      Ready: { Maintenance: 1 },
      Maintenance: { Ready: 1 },
    },
    {
      Ready: uniformHoldingTime(3, 5),
      Maintenance: deterministicHoldingTime(2),
    },
  );

  const maintenance = new ConstrainedMDP({
    mdp: {
      states: ["Ready", "Degraded"],
      actions: ["Monitor", "Maintain"],
      discount: 0.9,
      transition: {
        Ready: {
          Monitor: { Ready: 0.9, Degraded: 0.1 },
          Maintain: { Ready: 0.98, Degraded: 0.02 },
        },
        Degraded: {
          Monitor: { Ready: 0.15, Degraded: 0.85 },
          Maintain: { Ready: 0.8, Degraded: 0.2 },
        },
      },
      reward: {
        Ready: { Monitor: 5, Maintain: 2 },
        Degraded: { Monitor: -7, Maintain: 4 },
      },
    },
    costs: {
      Ready: { Monitor: 0.2, Maintain: 2 },
      Degraded: { Monitor: 0.4, Maintain: 2 },
    },
    budget: 20,
  });

  const normalBelief = healthEvidence.forward(["Normal"]).posterior;
  const warningBelief = healthEvidence.forward(["Warning", "Warning"]).posterior;
  const stationary = availability.stationary();
  const cycle = readinessCycle.simulateUntil(12, "Ready", { rng: new SeededRng(101) });
  const policy = maintenance.solve({ start: "Degraded" });

  expect(warningBelief.Degraded).toBeGreaterThan(normalBelief.Degraded);
  expect(stationary.Ready).toBeCloseTo(0.8);
  expect(cycle.map((event) => event.state)).toEqual(["Ready", "Maintenance", "Ready", "Maintenance", "Ready"]);
  expect(policy.policy.Degraded).toBe("Maintain");
  expect(policy.feasible).toBe(true);
  expect(Math.max(...Object.values(policy.costValues))).toBeLessThanOrEqual(maintenance.budget);
});
