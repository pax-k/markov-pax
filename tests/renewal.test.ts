import { describe, expect, test } from "bun:test";
import {
  RenewalProcess,
  deterministicHoldingTime,
  estimateRenewalRate,
  renewalReward,
} from "../index.ts";

describe("RenewalProcess", () => {
  test("counts repeated events and rewards", () => {
    const process = new RenewalProcess(deterministicHoldingTime(2));
    expect(process.eventTimesUntil(5)).toEqual([2, 4]);
    expect(process.countBy(5)).toBe(2);
    expect(process.estimateRenewalRate(5)).toBeCloseTo(0.4);
    expect(estimateRenewalRate(process, 5)).toBeCloseTo(0.4);
    expect(renewalReward(process, 5, 10)).toBe(20);
  });

  test("rejects invalid renewal inputs", () => {
    const process = new RenewalProcess({ sample: () => 0, mean: () => 0 });
    expect(() => process.eventTimesUntil(1)).toThrow();
    expect(() => process.eventTimesUntil(0)).toThrow();
    expect(() => renewalReward(new RenewalProcess(deterministicHoldingTime(1)), 1, Number.NaN)).toThrow();
  });
});
