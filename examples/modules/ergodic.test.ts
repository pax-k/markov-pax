import { describe, expect, test } from "bun:test";
import { MarkovChain, SeededRng, compareTimeAndStationaryAverage } from "../../index.ts";

describe("module example: ergodic averages", () => {
  test("compares one long trajectory to the stationary expectation", () => {
    const chain = MarkovChain.from({ Up: { Up: 0.8, Down: 0.2 }, Down: { Up: 0.3, Down: 0.7 } });
    const result = compareTimeAndStationaryAverage(
      chain,
      "Up",
      100,
      (state) => (state === "Up" ? 1 : 0),
      { rng: new SeededRng(7) },
    );

    expect(Math.abs(result.difference)).toBeLessThan(0.3);
  });
});
