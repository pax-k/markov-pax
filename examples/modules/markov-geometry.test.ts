import { describe, expect, test } from "bun:test";
import { MarkovChain, conductance, dirichletForm, metastableCommunities } from "../../index.ts";

describe("module example: Markov geometry", () => {
  test("uses conductance to find sticky communities in a finite chain", () => {
    const chain = MarkovChain.from({
      a: { a: 0.45, b: 0.45, c: 0.05, d: 0.05 },
      b: { a: 0.45, b: 0.45, c: 0.05, d: 0.05 },
      c: { a: 0.05, b: 0.05, c: 0.45, d: 0.45 },
      d: { a: 0.05, b: 0.05, c: 0.45, d: 0.45 },
    });

    expect(dirichletForm(chain, { a: 0, b: 0, c: 1, d: 1 })).toBeCloseTo(0.05);
    expect(conductance(chain, ["a", "b"])).toBeCloseTo(0.1);
    expect(metastableCommunities(chain, { threshold: 0.2 })[0]!.states).toEqual(["a", "b"]);
  });
});
