import { describe, expect, test } from "bun:test";
import {
  MarkovChain,
  commuteDistance,
  conductance,
  dirichletForm,
  effectiveResistanceDistance,
  exitProbability,
  hittingTime,
  lowConductanceCuts,
  metastableCommunities,
} from "../index.ts";

describe("Markov geometry and communities", () => {
  test("computes Dirichlet energy, conductance, exits, and distances", () => {
    const chain = MarkovChain.from({
      a: { a: 0.45, b: 0.45, c: 0.05, d: 0.05 },
      b: { a: 0.45, b: 0.45, c: 0.05, d: 0.05 },
      c: { a: 0.05, b: 0.05, c: 0.45, d: 0.45 },
      d: { a: 0.05, b: 0.05, c: 0.45, d: 0.45 },
    });

    expect(dirichletForm(chain, { a: 0, b: 0, c: 1, d: 1 })).toBeCloseTo(0.05);
    expect(conductance(chain, ["a", "b"])).toBeCloseTo(0.1);
    expect(exitProbability(chain, ["a", "b"])).toBeCloseTo(0.1);

    const hitD = hittingTime(chain, "d");
    expect(hitD.d).toBe(0);
    expect(hitD.a).toBeGreaterThan(0);

    expect(commuteDistance(chain, "a", "d")).toBeCloseTo(commuteDistance(chain, "d", "a"));
    expect(commuteDistance(chain, "a", "a")).toBe(0);
    expect(effectiveResistanceDistance(chain, "a", "d")).toBeCloseTo(commuteDistance(chain, "a", "d"));

    const cuts = lowConductanceCuts(chain, { maxCutSize: 2, limit: 2 });
    expect(cuts[0]!.states).toEqual(["a", "b"]);
    expect(cuts[0]!.conductance).toBeCloseTo(0.1);
    expect(metastableCommunities(chain, { threshold: 0.2, limit: 3 }).length).toBeGreaterThan(0);
    expect(() => lowConductanceCuts(chain, { maxCandidates: 1 })).toThrow(/candidate/i);
  });

  test("rejects invalid geometry inputs and unsupported nonreversible distances", () => {
    const chain = MarkovChain.from({
      a: { b: 1 },
      b: { b: 1 },
    });

    expect(() => dirichletForm(chain, { a: 1 })).toThrow(/Missing value/i);
    expect(() => conductance(chain, ["a", "b"])).toThrow(/proper subset/i);
    expect(() => exitProbability(chain, ["missing" as "a"])).toThrow(/unknown visible/i);
    expect(() => hittingTime(chain, "missing" as "a")).toThrow(/Unknown target/i);
    const nonReversible = MarkovChain.from({
      a: { b: 1 },
      b: { c: 1 },
      c: { a: 1 },
    });
    expect(() => effectiveResistanceDistance(nonReversible, "a", "b")).toThrow(/reversible/i);

    const oneState = MarkovChain.from({
      only: { only: 1 },
    });
    expect(hittingTime(oneState, "only").only).toBe(0);
  });
});
