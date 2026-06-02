import { describe, expect, test } from "bun:test";
import { basisStateCloner, verifyNoUniversalLinearCloner } from "../../index.ts";

describe("theory example: Markov linear no-cloning", () => {
  test("basis-state copying does not linearly produce independent product mixtures", () => {
    const result = verifyNoUniversalLinearCloner(
      basisStateCloner(["zero", "one"]),
      { zero: 0.5, one: 0.5 },
    );

    expect(result.basisStatesCloned).toBe(true);
    expect(result.idealProduct["zero|one"]!).toBeGreaterThan(result.cloned["zero|one"]!);
  });
});
