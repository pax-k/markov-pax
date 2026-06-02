import { describe, expect, test } from "bun:test";
import {
  SeededRng,
  SemiMarkovProcess,
  deterministicHoldingTime,
  empiricalHoldingTime,
  exponentialHoldingTime,
  uniformHoldingTime,
} from "../index.ts";

describe("SemiMarkovProcess", () => {
  test("simulates state changes with explicit holding-time distributions", () => {
    const process = SemiMarkovProcess.from(
      { Working: { Working: 0.5, Failed: 0.5 }, Failed: { Working: 1 } },
      {
        Working: deterministicHoldingTime(2),
        Failed: uniformHoldingTime(1, 1.5),
      },
    );
    const events = process.simulateUntil(5, "Working", { rng: new SeededRng(3) });
    const occupancy = process.occupancyTimes(events);
    expect(events[0]).toEqual({ state: "Working", start: 0, end: 2, duration: 2 });
    expect(occupancy.Working + occupancy.Failed).toBeCloseTo(5);
    expect(process.embeddedChain().states).toEqual(["Working", "Failed"]);
    expect(deterministicHoldingTime(2).mean()).toBe(2);
    expect(exponentialHoldingTime(2).sample(new SeededRng(1))).toBeGreaterThan(0);
    expect(exponentialHoldingTime(2).mean()).toBeCloseTo(0.5);
    expect(uniformHoldingTime(1, 3).mean()).toBe(2);
    expect(empiricalHoldingTime([1, 3]).mean()).toBe(2);
    expect(empiricalHoldingTime([1, 3]).sample(new SeededRng(1))).toBeGreaterThan(0);
  });

  test("rejects invalid holding times and process inputs", () => {
    expect(() => deterministicHoldingTime(0)).toThrow();
    expect(() => exponentialHoldingTime(-1)).toThrow();
    expect(() => uniformHoldingTime(2, 1)).toThrow();
    expect(() => empiricalHoldingTime([])).toThrow();
    expect(() => empiricalHoldingTime([0])).toThrow();
    expect(() => SemiMarkovProcess.from({ A: { A: 1 } }, {} as never)).toThrow();
    const bad = SemiMarkovProcess.from({ A: { A: 1 } }, { A: { sample: () => 0, mean: () => 0 } });
    expect(() => bad.simulateUntil(1, "A")).toThrow();
    expect(() => bad.simulateUntil(0, "A")).toThrow();
  });
});
