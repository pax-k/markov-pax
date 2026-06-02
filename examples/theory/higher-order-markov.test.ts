import { describe, expect, test } from "bun:test";
import { HigherOrderMarkovModel } from "../../index.ts";

describe("theory example: higher-order Markov property", () => {
  test("uses Pr(X_{n+1} | X_n, ..., X_{n-k+1})", () => {
    const model = HigherOrderMarkovModel.fit([["A", "B", "A", "B", "C"]], { order: 2 });

    expect(model.predictNext(["A", "B"]).A).toBeGreaterThan(0);
    expect(model.predictNext(["B", "A"]).B).toBe(1);
  });
});
