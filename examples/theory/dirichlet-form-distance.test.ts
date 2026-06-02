import { describe, expect, test } from "bun:test";
import { MarkovChain, commuteDistance, dirichletForm } from "../../index.ts";

describe("theory example: Dirichlet forms and diffusion distance", () => {
  test("assigns low energy to functions that vary only across rare transitions", () => {
    const chain = MarkovChain.from({
      a: { a: 0.45, b: 0.45, c: 0.05, d: 0.05 },
      b: { a: 0.45, b: 0.45, c: 0.05, d: 0.05 },
      c: { a: 0.05, b: 0.05, c: 0.45, d: 0.45 },
      d: { a: 0.05, b: 0.05, c: 0.45, d: 0.45 },
    });

    expect(dirichletForm(chain, { a: 0, b: 0, c: 1, d: 1 })).toBeLessThan(0.1);
    expect(commuteDistance(chain, "a", "d")).toBeCloseTo(commuteDistance(chain, "d", "a"));
  });
});
