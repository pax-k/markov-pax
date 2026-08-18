import { expect, test } from "bun:test";
import {
  ConstrainedMDP,
  MMcQueue,
  SeededRng,
  SemiMarkovProcess,
  deterministicHoldingTime,
  uniformHoldingTime,
} from "../../index.ts";

test("synthetic training residence times support a feasible resource allocation", () => {
  const readinessCycle = SemiMarkovProcess.from(
    {
      InTraining: { Certified: 1 },
      Certified: { InTraining: 1 },
    },
    {
      InTraining: uniformHoldingTime(3, 5),
      Certified: deterministicHoldingTime(7),
    },
  );
  const forecast = readinessCycle.simulateUntil(30, "InTraining", { rng: new SeededRng(303) });
  const occupancy = readinessCycle.occupancyTimes(forecast);
  const trainingQueue = new MMcQueue({ arrivalRate: 3, serviceRate: 2, servers: 2 });

  const allocation = new ConstrainedMDP({
    mdp: {
      states: ["TrainingBacklog", "CertifiedPool"],
      actions: ["StandardAllocation", "AddInstructor"],
      discount: 0.8,
      transition: {
        TrainingBacklog: {
          StandardAllocation: { TrainingBacklog: 0.7, CertifiedPool: 0.3 },
          AddInstructor: { TrainingBacklog: 0.25, CertifiedPool: 0.75 },
        },
        CertifiedPool: {
          StandardAllocation: { TrainingBacklog: 0.15, CertifiedPool: 0.85 },
          AddInstructor: { TrainingBacklog: 0.08, CertifiedPool: 0.92 },
        },
      },
      reward: {
        TrainingBacklog: { StandardAllocation: -4, AddInstructor: 7 },
        CertifiedPool: { StandardAllocation: 6, AddInstructor: 2 },
      },
    },
    costs: {
      TrainingBacklog: { StandardAllocation: 1, AddInstructor: 3 },
      CertifiedPool: { StandardAllocation: 1, AddInstructor: 3 },
    },
    budget: 15,
  });
  const policy = allocation.solve({ start: "TrainingBacklog" });

  expect(occupancy.InTraining).toBeGreaterThan(0);
  expect(occupancy.Certified).toBeGreaterThan(occupancy.InTraining);
  expect(occupancy.InTraining + occupancy.Certified).toBeCloseTo(30);
  expect(trainingQueue.utilization()).toBeLessThan(1);
  expect(policy.policy.TrainingBacklog).toBe("AddInstructor");
  expect(policy.feasible).toBe(true);
  expect(Math.max(...Object.values(policy.costValues))).toBeLessThanOrEqual(allocation.budget);
});
