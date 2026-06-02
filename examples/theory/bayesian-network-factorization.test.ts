import { describe, expect, test } from "bun:test";
import { BayesianNetwork } from "../../index.ts";

const key = (values: readonly string[]) => JSON.stringify(values);

describe("theory example: Bayesian network factorization", () => {
  test("computes a joint probability as a product of local CPDs", () => {
    const bn = new BayesianNetwork({
      variables: ["A", "B"],
      domains: { A: ["t", "f"], B: ["t", "f"] },
      parents: { A: [], B: ["A"] },
      cpt: {
        A: { [key([])]: { t: 0.3, f: 0.7 } },
        B: { [key(["t"])]: { t: 0.8, f: 0.2 }, [key(["f"])]: { t: 0.1, f: 0.9 } },
      },
    });

    expect(bn.jointProbability({ A: "t", B: "t" })).toBeCloseTo(0.3 * 0.8);
  });
});
