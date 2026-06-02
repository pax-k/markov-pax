import { describe, expect, test } from "bun:test";
import { basisStateCloner, verifyNoUniversalLinearCloner } from "../../index.ts";

describe("module example: Markov no-cloning demo", () => {
  test("shows a linear Markov cloner for basis states fails on mixtures", () => {
    const cloner = basisStateCloner(["zero", "one"]);
    const result = verifyNoUniversalLinearCloner(cloner, { zero: 0.5, one: 0.5 });

    expect(result.basisStatesCloned).toBe(true);
    expect(result.mixtureCloned).toBe(false);
    expect(result.distance).toBeGreaterThan(0);
  });
});
