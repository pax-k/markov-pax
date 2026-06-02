import { describe, expect, test } from "bun:test";
import {
  BayesianNetwork,
  FactorGraph,
  MarkovRandomField,
  SeededRng,
  mrfEdgeKey,
} from "../index.ts";

const key = (values: readonly string[]) => JSON.stringify(values);

describe("finite graphical models", () => {
  test("computes factor graph weights and marginals", () => {
    const graph = new FactorGraph({
      variables: ["A", "B"],
      domains: { A: ["t", "f"], B: ["t", "f"] },
      factors: [
        { variables: ["A"], table: { [key(["t"])]: 2, [key(["f"])]: 1 } },
        {
          variables: ["A", "B"],
          table: {
            [key(["t", "t"])]: 3,
            [key(["t", "f"])]: 1,
            [key(["f", "t"])]: 1,
            [key(["f", "f"])]: 3,
          },
        },
      ],
    });
    expect(graph.jointWeight({ A: "t", B: "t" })).toBe(6);
    expect(graph.marginal("A").t!).toBeGreaterThan(graph.marginal("A").f!);
  });

  test("samples and queries Bayesian networks exactly", () => {
    const bn = new BayesianNetwork({
      variables: ["Rain", "Sprinkler", "Wet"],
      domains: { Rain: ["T", "F"], Sprinkler: ["T", "F"], Wet: ["T", "F"] },
      parents: { Rain: [], Sprinkler: ["Rain"], Wet: ["Rain", "Sprinkler"] },
      cpt: {
        Rain: { [key([])]: { T: 0.2, F: 0.8 } },
        Sprinkler: {
          [key(["T"])]: { T: 0.01, F: 0.99 },
          [key(["F"])]: { T: 0.4, F: 0.6 },
        },
        Wet: {
          [key(["T", "T"])]: { T: 0.99, F: 0.01 },
          [key(["T", "F"])]: { T: 0.8, F: 0.2 },
          [key(["F", "T"])]: { T: 0.9, F: 0.1 },
          [key(["F", "F"])]: { T: 0.05, F: 0.95 },
        },
      },
    });
    expect(bn.jointProbability({ Rain: "T", Sprinkler: "F", Wet: "T" })).toBeCloseTo(0.2 * 0.99 * 0.8);
    expect(bn.query("Rain", { Wet: "T" }).T).toBeGreaterThan(0.2);
    expect(bn.sample({ rng: new SeededRng(1) }).Rain).toBeDefined();
  });

  test("runs MRF conditionals, Gibbs sampling, and local MAP search", () => {
    const mrf = new MarkovRandomField({
      variables: ["Left", "Right"],
      domains: { Left: ["dark", "light"], Right: ["dark", "light"] },
      edges: [["Left", "Right"]],
      unary: {
        Left: { dark: 2, light: 1 },
        Right: { dark: 2, light: 1 },
      },
      pairwise: {
        [mrfEdgeKey("Left", "Right")]: {
          [key(["dark", "dark"])]: 4,
          [key(["light", "light"])]: 4,
          [key(["dark", "light"])]: 1,
          [key(["light", "dark"])]: 1,
        },
      },
    });
    expect(mrf.energy({ Left: "dark", Right: "dark" })).toBeLessThan(mrf.energy({ Left: "dark", Right: "light" }));
    expect(mrf.conditional("Left", { Left: "light", Right: "dark" }).dark).toBeGreaterThan(0.5);
    expect(mrf.gibbsSample({ Left: "light", Right: "dark" }, 2, { rng: new SeededRng(2) })).toHaveLength(3);
    expect(mrf.mapLocalSearch({ Left: "light", Right: "dark" }, 2).assignment.Left).toBe("dark");

    const reverse = new MarkovRandomField({
      variables: ["A", "B"],
      domains: { A: ["0", "1"], B: ["0", "1"] },
      edges: [["A", "B"]],
      unary: { A: { "0": 1, "1": 1 }, B: { "0": 1, "1": 1 } },
      pairwise: { [mrfEdgeKey("A", "B")]: { [key(["1", "0"])]: 2 } },
    });
    expect(reverse.energy({ A: "0", B: "1" })).toBeLessThan(1);
  });

  test("rejects invalid graphical model configs and evidence", () => {
    expect(() => new FactorGraph({ variables: ["A"], domains: { A: [] }, factors: [] })).toThrow();
    expect(() => new FactorGraph({ variables: ["A"], domains: { A: ["t"] }, factors: [{ variables: ["B" as "A"], table: { [key(["t"])]: 1 } }] })).toThrow();
    expect(() => new FactorGraph({ variables: ["A"], domains: { A: ["t"] }, factors: [{ variables: ["A"], table: { [key(["t"])]: 0 } }] })).toThrow();
    expect(() => new FactorGraph({ variables: ["A"], domains: { A: ["t"] }, factors: [{ variables: ["A"], table: {} }] }).jointWeight({ A: "t" })).toThrow();
    expect(() => new FactorGraph({ variables: ["A"], domains: { A: ["t"] }, factors: [] }).jointWeight({} as never)).toThrow();
    expect(() => new FactorGraph({ variables: ["A"], domains: { A: ["t"] }, factors: [] }).marginal("A", { A: "x" })).toThrow();

    expect(() => new BayesianNetwork({
      variables: ["A", "B"],
      domains: { A: ["t"], B: ["t"] },
      parents: { A: ["B"], B: ["A"] },
      cpt: { A: { [key(["t"])]: { t: 1 } }, B: { [key(["t"])]: { t: 1 } } },
    })).toThrow();
    expect(() => new BayesianNetwork({
      variables: ["A"],
      domains: { A: ["t"] },
      parents: { A: [] },
      cpt: { A: {} },
    })).toThrow();

    expect(() => new MarkovRandomField({
      variables: ["A", "B"],
      domains: { A: ["0"], B: ["0"] },
      edges: [["A", "B"]],
      unary: { A: { "0": 1 }, B: { "0": 1 } },
      pairwise: {},
    })).toThrow();
    expect(() => new MarkovRandomField({
      variables: ["A", "B"],
      domains: { A: ["0"], B: ["0"] },
      edges: [["A", "B"]],
      unary: { A: { "0": 1 }, B: { "0": 1 } },
      pairwise: { [mrfEdgeKey("A", "B")]: { [key(["0", "0"])]: 0 } },
    })).toThrow();
  });
});
