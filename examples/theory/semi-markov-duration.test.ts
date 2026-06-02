import { describe, expect, test } from "bun:test";
import { SemiMarkovProcess, deterministicHoldingTime } from "../../index.ts";

describe("theory example: semi-Markov durations", () => {
  test("adds holding-time distributions to embedded Markov transitions", () => {
    const process = SemiMarkovProcess.from(
      { A: { B: 1 }, B: { A: 1 } },
      { A: deterministicHoldingTime(2), B: deterministicHoldingTime(3) },
    );

    const events = process.simulateUntil(5, "A");

    expect(events.map((event) => event.duration)).toEqual([2, 3]);
  });
});
