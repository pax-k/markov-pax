import { describe, expect, test } from "bun:test";
import { HigherOrderMarkovModel, SeededRng } from "../index.ts";

describe("HigherOrderMarkovModel", () => {
  test("fits, predicts, simulates, and converts to first-order context states", () => {
    const model = HigherOrderMarkovModel.fit(
      [
        ["A", "B", "A", "B", "C"],
        ["A", "B", "A", "B", "A"],
      ],
      { order: 2, smoothing: 0.5 },
    );

    const prediction = model.predictNext(["A", "B"]);
    expect(prediction.A).toBeGreaterThan(prediction.C);
    expect(model.simulate(["A", "B"], 3, { rng: new SeededRng(2) })).toHaveLength(5);

    const firstOrder = model.toFirstOrderChain();
    expect(firstOrder.states).toContain(JSON.stringify(["A", "B"]));
    expect(firstOrder.stepFrom(JSON.stringify(["A", "B"]))).toBeDefined();
  });

  test("rejects invalid contexts and fitting options", () => {
    expect(() => new HigherOrderMarkovModel(0, ["A"], { [JSON.stringify(["A"])]: { A: 1 } })).toThrow();
    expect(() => HigherOrderMarkovModel.fit([["A"]], { order: 1 })).toThrow();
    expect(() => HigherOrderMarkovModel.fit([["A", "B"]], { order: 0 })).toThrow();
    expect(() => HigherOrderMarkovModel.fit([["A", "B"]], { order: 1, smoothing: -1 })).toThrow();
    const model = HigherOrderMarkovModel.fit([["A", "B", "C"]], { order: 2 });
    expect(() => model.predictNext(["A"])).toThrow();
    expect(() => model.predictNext(["B", "C"])).toThrow();
    expect(() => model.simulate(["A", "B"], -1)).toThrow();
  });
});
