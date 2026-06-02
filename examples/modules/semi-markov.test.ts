import { describe, expect, test } from "bun:test";
import { SeededRng, SemiMarkovProcess, deterministicHoldingTime, uniformHoldingTime } from "../../index.ts";

describe("module example: semi-Markov processes", () => {
  test("models transitions where state duration is part of the process", () => {
    const machine = SemiMarkovProcess.from(
      { Running: { Running: 0.6, Repair: 0.4 }, Repair: { Running: 1 } },
      { Running: deterministicHoldingTime(8), Repair: uniformHoldingTime(1, 2) },
    );

    const events = machine.simulateUntil(24, "Running", { rng: new SeededRng(8) });
    const occupancy = machine.occupancyTimes(events);

    expect(events[0]!.duration).toBe(8);
    expect(occupancy.Running + occupancy.Repair).toBeCloseTo(24);
  });
});
