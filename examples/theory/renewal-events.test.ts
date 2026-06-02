import { describe, expect, test } from "bun:test";
import { RenewalProcess, deterministicHoldingTime } from "../../index.ts";

describe("theory example: renewal event times", () => {
  test("computes S_n = X_1 + ... + X_n for repeated waits", () => {
    const process = new RenewalProcess(deterministicHoldingTime(4));

    expect(process.eventTimesUntil(13)).toEqual([4, 8, 12]);
  });
});
