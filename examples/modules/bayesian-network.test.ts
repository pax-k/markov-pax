import { describe, expect, test } from "bun:test";
import { BayesianNetwork } from "../../index.ts";

const key = (values: readonly string[]) => JSON.stringify(values);

describe("module example: Bayesian networks", () => {
  test("queries a small directed graphical model by exact enumeration", () => {
    const diagnosis = new BayesianNetwork({
      variables: ["Disease", "Test"],
      domains: { Disease: ["yes", "no"], Test: ["positive", "negative"] },
      parents: { Disease: [], Test: ["Disease"] },
      cpt: {
        Disease: { [key([])]: { yes: 0.05, no: 0.95 } },
        Test: {
          [key(["yes"])]: { positive: 0.9, negative: 0.1 },
          [key(["no"])]: { positive: 0.1, negative: 0.9 },
        },
      },
    });

    expect(diagnosis.query("Disease", { Test: "positive" }).yes).toBeGreaterThan(0.05);
  });
});
