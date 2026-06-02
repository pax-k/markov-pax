import { describe, expect, test } from "bun:test";
import { SeededRng, voterModel } from "../../index.ts";

describe("module example: interacting particle systems", () => {
  test("simulates local opinion copying on a graph", () => {
    const model = voterModel({ A: ["B"], B: ["A", "C"], C: ["B"] }, { A: 1, B: 0, C: 0 });
    const path = model.simulate(5, { rng: new SeededRng(9) });

    expect(path).toHaveLength(6);
    expect(Object.values(model.stateCounts(path.at(-1)!)).reduce((a, b) => a + b, 0)).toBe(3);
  });
});
