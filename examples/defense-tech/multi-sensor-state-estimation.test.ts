import { expect, test } from "bun:test";
import { BayesianNetwork, MultiObjectiveMDP, POMDP } from "../../index.ts";

const key = (values: readonly string[]) => JSON.stringify(values);
const total = (values: Record<string, number>) => Object.values(values).reduce((sum, value) => sum + value, 0);

test("sequential synthetic observations normalize belief and select an uncertainty-reducing sensor task", () => {
  const estimator = POMDP.from({
    states: ["Nominal", "Changed"],
    actions: ["Observe"],
    observations: ["NominalReading", "ChangeReading"],
    transition: {
      Nominal: { Observe: { Nominal: 0.88, Changed: 0.12 } },
      Changed: { Observe: { Nominal: 0.18, Changed: 0.82 } },
    },
    observation: {
      Nominal: { Observe: { NominalReading: 0.85, ChangeReading: 0.15 } },
      Changed: { Observe: { NominalReading: 0.25, ChangeReading: 0.75 } },
    },
  });
  const first = estimator.updateBelief({
    belief: { Nominal: 0.7, Changed: 0.3 },
    action: "Observe",
    observation: "ChangeReading",
  });
  const second = estimator.updateBelief({
    belief: first,
    action: "Observe",
    observation: "ChangeReading",
  });

  const fusion = new BayesianNetwork({
    variables: ["Condition", "SensorA", "SensorB"],
    domains: {
      Condition: ["nominal", "changed"],
      SensorA: ["nominal", "change"],
      SensorB: ["nominal", "change"],
    },
    parents: { Condition: [], SensorA: ["Condition"], SensorB: ["Condition"] },
    cpt: {
      Condition: { [key([])]: { nominal: 0.7, changed: 0.3 } },
      SensorA: {
        [key(["nominal"])]: { nominal: 0.85, change: 0.15 },
        [key(["changed"])]: { nominal: 0.25, change: 0.75 },
      },
      SensorB: {
        [key(["nominal"])]: { nominal: 0.8, change: 0.2 },
        [key(["changed"])]: { nominal: 0.2, change: 0.8 },
      },
    },
  });
  const fused = fusion.query("Condition", { SensorA: "change", SensorB: "change" });

  const sensorTasking = new MultiObjectiveMDP({
    states: ["Uncertain", "Resolved"],
    actions: ["PassiveMonitor", "TaskSecondarySensor", "TaskIndependentSensor"],
    discount: 0.8,
    transition: {
      Uncertain: {
        PassiveMonitor: { Uncertain: 0.75, Resolved: 0.25 },
        TaskSecondarySensor: { Uncertain: 0.35, Resolved: 0.65 },
        TaskIndependentSensor: { Uncertain: 0.15, Resolved: 0.85 },
      },
      Resolved: {
        PassiveMonitor: { Uncertain: 0.1, Resolved: 0.9 },
        TaskSecondarySensor: { Uncertain: 0.05, Resolved: 0.95 },
        TaskIndependentSensor: { Uncertain: 0.03, Resolved: 0.97 },
      },
    },
    objectives: {
      InformationGain: {
        Uncertain: { PassiveMonitor: 1, TaskSecondarySensor: 6, TaskIndependentSensor: 9 },
        Resolved: { PassiveMonitor: 5, TaskSecondarySensor: 3, TaskIndependentSensor: 2 },
      },
      ResourceEfficiency: {
        Uncertain: { PassiveMonitor: 9, TaskSecondarySensor: 6, TaskIndependentSensor: 4 },
        Resolved: { PassiveMonitor: 9, TaskSecondarySensor: 5, TaskIndependentSensor: 3 },
      },
    },
    weights: { InformationGain: 0.7, ResourceEfficiency: 0.3 },
  });
  const policy = sensorTasking.solve().policy;

  expect(total(second)).toBeCloseTo(1);
  expect(second.Changed).toBeGreaterThan(first.Changed);
  expect(fused.changed).toBeGreaterThan(0.3);
  expect(policy.Uncertain).toBe("TaskIndependentSensor");
  expect(sensorTasking.mdp.transition.Uncertain.TaskIndependentSensor[1]).toBeGreaterThan(
    sensorTasking.mdp.transition.Uncertain.PassiveMonitor[1]!,
  );
});
