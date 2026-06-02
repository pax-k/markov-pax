import { describe, expect, test } from "bun:test";
import { MarkovChain } from "../../index.ts";

describe("theory example: periodicity and reducibility", () => {
  test("detects a periodic chain and a reducible chain", () => {
    const periodic = MarkovChain.from({
      A: { B: 1 },
      B: { A: 1 },
    });

    expect(periodic.isIrreducible()).toBe(true);
    expect(periodic.isAperiodic()).toBe(false);
    expect(periodic.period("A")).toBe(2);

    const reducible = MarkovChain.from({
      Active: { Active: 0.8, Churned: 0.2 },
      Churned: { Churned: 1 },
    });

    const classification = reducible.classify();
    expect(reducible.isIrreducible()).toBe(false);
    expect(classification.Active.transient).toBe(true);
    expect(classification.Churned.absorbing).toBe(true);
  });
});
