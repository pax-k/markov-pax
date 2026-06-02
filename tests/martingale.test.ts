import { describe, expect, test } from "bun:test";
import {
  MarkovChain,
  SeededRng,
  estimateOptionalStopping,
  harmonicResidual,
  hittingProbability,
  isHarmonic,
  solveDirichletProblem,
} from "../index.ts";

describe("martingale and harmonic finite-chain utilities", () => {
  test("solves harmonic hitting probabilities and optional stopping estimates", () => {
    const ruin = MarkovChain.from({
      "0": { "0": 1 },
      "1": { "0": 0.5, "2": 0.5 },
      "2": { "1": 0.5, "3": 0.5 },
      "3": { "3": 1 },
    });
    const h = hittingProbability(ruin, "3", ["0"]);
    expect(h["1"]).toBeCloseTo(1 / 3);
    expect(h["2"]).toBeCloseTo(2 / 3);
    expect(isHarmonic(ruin, h)).toBe(true);
    expect(harmonicResidual(ruin, h)["1"]).toBeCloseTo(0);

    const allBoundary = solveDirichletProblem(ruin, { "0": 0, "1": 1, "2": 2, "3": 3 });
    expect(allBoundary["2"]).toBe(2);

    const stopped = estimateOptionalStopping(ruin, h, "1", {
      trials: 20,
      maxSteps: 10,
      stop: (state) => state === "0" || state === "3",
      rng: new SeededRng(4),
    });
    expect(Math.abs(stopped.difference)).toBeLessThan(0.5);
  });

  test("rejects invalid harmonic and stopping inputs", () => {
    const chain = MarkovChain.from({ A: { B: 1 }, B: { B: 1 } });
    expect(() => harmonicResidual(chain, { A: 0 })).toThrow();
    expect(() => solveDirichletProblem(chain, {})).toThrow();
    expect(() => solveDirichletProblem(chain, { C: 1 } as never)).toThrow();
    expect(() => hittingProbability(chain, "A", ["A"])).toThrow();
    expect(() => estimateOptionalStopping(chain, { A: 0, B: 1 }, "A", { trials: 0, maxSteps: 1, stop: () => true })).toThrow();
    expect(() => estimateOptionalStopping(chain, { A: 0, B: 1 }, "A", { trials: 1, maxSteps: -1, stop: () => true })).toThrow();
  });
});
