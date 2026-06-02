import { describe, expect, test } from "bun:test";
import {
  CTMC,
  MDP,
  MM1Queue,
  MarkovChain,
  RenewalProcess,
  SeededRng,
  SemiMarkovProcess,
  compareTimeAndStationaryAverage,
  deterministicHoldingTime,
  exponentialHoldingTime,
  renewalReward,
} from "../../index.ts";

describe("real-world example: SRE incident simulator", () => {
  test("models service health, incident recurrence, support pressure, and mitigation policy", () => {
    const reliability = CTMC.fromGenerator({
      Healthy: { Healthy: -0.02, Degraded: 0.02 },
      Degraded: { Healthy: 0.25, Degraded: -0.3, Outage: 0.05 },
      Outage: { Outage: -0.4, Recovering: 0.4 },
      Recovering: { Healthy: 0.6, Recovering: -0.6 },
    });

    const incidentClock = new RenewalProcess(deterministicHoldingTime(14));
    const incidentCost = renewalReward(incidentClock, 60, 2_000);

    const incidentLifecycle = SemiMarkovProcess.from(
      { Detect: { Mitigate: 1 }, Mitigate: { Recover: 0.9, Escalate: 0.1 }, Recover: { Recover: 1 }, Escalate: { Recover: 1 } },
      {
        Detect: exponentialHoldingTime(1 / 0.5),
        Mitigate: deterministicHoldingTime(2),
        Recover: deterministicHoldingTime(1),
        Escalate: deterministicHoldingTime(4),
      },
    );

    const mitigation = MDP.from({
      states: ["Degraded", "Outage"],
      actions: ["Restart", "Rollback"],
      discount: 0.9,
      transition: {
        Degraded: {
          Restart: { Degraded: 0.7, Outage: 0.3 },
          Rollback: { Degraded: 0.85, Outage: 0.15 },
        },
        Outage: {
          Restart: { Degraded: 0.55, Outage: 0.45 },
          Rollback: { Degraded: 0.8, Outage: 0.2 },
        },
      },
      reward: {
        Degraded: { Restart: 1, Rollback: 3 },
        Outage: { Restart: -3, Rollback: 2 },
      },
    });

    const availability = reliability.stationary();
    const hourlyReliability = MarkovChain.fromMatrix(
      ["Healthy", "Degraded", "Outage", "Recovering"],
      reliability.transitionMatrix(1),
    );
    const ticketQueue = new MM1Queue({ arrivalRate: 18, serviceRate: 24 });
    const lifecycle = incidentLifecycle.simulateUntil(8, "Detect", { rng: new SeededRng(40) });
    const policy = mitigation.valueIteration().policy;
    const longRun = compareTimeAndStationaryAverage(
      hourlyReliability,
      "Healthy",
      24,
      (state) => state === "Healthy" ? 1 : 0,
      { rng: new SeededRng(41) },
    );

    expect(availability.Healthy).toBeGreaterThan(availability.Outage);
    expect(incidentCost).toBe(8_000);
    expect(lifecycle.some((event) => event.state === "Mitigate")).toBe(true);
    expect(policy.Outage).toBe("Rollback");
    expect(ticketQueue.expectedTimeInSystem()).toBeGreaterThan(0);
    expect(longRun.stationaryExpectation).toBeGreaterThan(0.7);
  });
});
