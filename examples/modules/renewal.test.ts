import { describe, expect, test } from "bun:test";
import { RenewalProcess, deterministicHoldingTime, renewalReward } from "../../index.ts";

describe("module example: renewal processes", () => {
  test("counts repeated events over a time horizon", () => {
    const inspections = new RenewalProcess(deterministicHoldingTime(30));

    expect(inspections.eventTimesUntil(100)).toEqual([30, 60, 90]);
    expect(inspections.countBy(100)).toBe(3);
    expect(renewalReward(inspections, 100, 50)).toBe(150);
  });
});
