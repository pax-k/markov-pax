import { expect, test } from "bun:test";
import { CTMC, MDP, MM1Queue, MarkovChain } from "../../index.ts";

test("synthetic backup and repair decisions improve base-service availability", () => {
  const primaryOnly = CTMC.fromGenerator({
    Available: { Available: -0.2, Unavailable: 0.2 },
    Unavailable: { Available: 0.1, Unavailable: -0.1 },
  });
  const withBackupAndRepair = CTMC.fromGenerator({
    Available: { Available: -0.2, Unavailable: 0.2 },
    Unavailable: { Available: 0.4, Unavailable: -0.4 },
  });

  const cascadingFailure = MarkovChain.from({
    StableService: { StableService: 0.86, PrimaryLoss: 0.12, CascadingLoss: 0.02 },
    PrimaryLoss: { StableService: 0.35, PrimaryLoss: 0.4, CascadingLoss: 0.25 },
    CascadingLoss: { StableService: 0.15, PrimaryLoss: 0.35, CascadingLoss: 0.5 },
  });
  const cascadeForecast = cascadingFailure.distributionAfter({ PrimaryLoss: 1 }, 3);
  const repairQueue = new MM1Queue({ arrivalRate: 2, serviceRate: 5 });

  const resiliencePolicy = MDP.from({
    states: ["StableService", "PrimaryLoss", "CascadingLoss"],
    actions: ["Monitor", "ActivateBackup", "DispatchRepair"],
    discount: 0.85,
    transition: {
      StableService: {
        Monitor: { StableService: 0.9, PrimaryLoss: 0.09, CascadingLoss: 0.01 },
        ActivateBackup: { StableService: 0.97, PrimaryLoss: 0.03 },
        DispatchRepair: { StableService: 0.96, PrimaryLoss: 0.04 },
      },
      PrimaryLoss: {
        Monitor: { StableService: 0.15, PrimaryLoss: 0.55, CascadingLoss: 0.3 },
        ActivateBackup: { StableService: 0.75, PrimaryLoss: 0.22, CascadingLoss: 0.03 },
        DispatchRepair: { StableService: 0.65, PrimaryLoss: 0.3, CascadingLoss: 0.05 },
      },
      CascadingLoss: {
        Monitor: { PrimaryLoss: 0.1, CascadingLoss: 0.9 },
        ActivateBackup: { StableService: 0.25, PrimaryLoss: 0.5, CascadingLoss: 0.25 },
        DispatchRepair: { StableService: 0.6, PrimaryLoss: 0.35, CascadingLoss: 0.05 },
      },
    },
    reward: {
      StableService: { Monitor: 6, ActivateBackup: 2, DispatchRepair: 1 },
      PrimaryLoss: { Monitor: -7, ActivateBackup: 7, DispatchRepair: 5 },
      CascadingLoss: { Monitor: -12, ActivateBackup: 3, DispatchRepair: 8 },
    },
  });
  const policy = resiliencePolicy.valueIteration().policy;

  expect(withBackupAndRepair.stationary().Available).toBeGreaterThan(primaryOnly.stationary().Available);
  expect(cascadeForecast.StableService).toBeGreaterThan(cascadeForecast.CascadingLoss);
  expect(repairQueue.expectedNumberInSystem()).toBeLessThan(1);
  expect(policy.PrimaryLoss).toBe("ActivateBackup");
  expect(policy.CascadingLoss).toBe("DispatchRepair");
});
