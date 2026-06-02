import { describe, expect, test } from "bun:test";
import {
  applyMarkovOperator,
  basisStateCloner,
  productDistribution,
  verifyNoUniversalLinearCloner,
  type MarkovOperator,
} from "../index.ts";

describe("finite Markov linear no-cloning demonstration", () => {
  test("clones basis states but not arbitrary mixtures into independent products", () => {
    const cloner = basisStateCloner(["zero", "one"]);

    const clonedZero = applyMarkovOperator(cloner, { zero: 1, one: 0 });
    expect(clonedZero["zero|zero"]).toBe(1);

    const idealProduct = productDistribution({ zero: 0.5, one: 0.5 });
    expect(idealProduct["zero|one"]).toBe(0.25);

    const result = verifyNoUniversalLinearCloner(cloner, { zero: 0.5, one: 0.5 });
    expect(result.basisStatesCloned).toBe(true);
    expect(result.mixtureCloned).toBe(false);
    expect(result.distance).toBeGreaterThan(0);
    expect(result.cloned["zero|one"]).toBe(0);
    expect(result.idealProduct["zero|one"]).toBe(0.25);
  });

  test("detects valid operators that do not even clone basis states", () => {
    const bad: MarkovOperator<"zero" | "one", "zero|zero" | "zero|one" | "one|zero" | "one|one"> = {
      inputStates: ["zero", "one"],
      outputStates: ["zero|zero", "zero|one", "one|zero", "one|one"],
      matrix: [
        [0, 1, 0, 0],
        [0, 0, 0, 1],
      ],
    };

    const result = verifyNoUniversalLinearCloner(bad, { zero: 1, one: 0 });
    expect(result.basisStatesCloned).toBe(false);
  });

  test("rejects invalid Markov operators and input distributions", () => {
    const cloner = basisStateCloner(["zero", "one"]);

    expect(() => applyMarkovOperator({
      inputStates: ["zero", "one"],
      outputStates: ["zero|zero"],
      matrix: [[1]],
    }, { zero: 1, one: 0 })).toThrow(/row count/i);

    expect(() => applyMarkovOperator({
      inputStates: ["zero"],
      outputStates: [],
      matrix: [[]],
    }, { zero: 1 })).toThrow(/output state/i);

    expect(() => applyMarkovOperator({
      inputStates: ["zero"],
      outputStates: ["zero|zero", "zero|one"],
      matrix: [[1]],
    }, { zero: 1 })).toThrow(/row width/i);

    expect(() => applyMarkovOperator({
      inputStates: ["zero"],
      outputStates: ["zero|zero"],
      matrix: [[-1]],
    }, { zero: 1 })).toThrow(/probability/i);

    expect(() => applyMarkovOperator({
      inputStates: ["zero"],
      outputStates: ["zero|zero"],
      matrix: [[0.5]],
    }, { zero: 1 })).toThrow(/sum to 1/i);

    expect(() => applyMarkovOperator(cloner, { zero: -1, one: 2 })).toThrow(/nonnegative/i);
    expect(() => applyMarkovOperator(cloner, { zero: 0.2, one: 0.2 })).toThrow(/sum to 1/i);
    expect(() => productDistribution({ zero: 1.5 })).toThrow(/probability/i);
  });
});
