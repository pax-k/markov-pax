import { describe, expect, test } from "bun:test";
import {
  AbsorbingChain,
  BirthDeathProcess,
  CTMC,
  HiddenMarkovModel,
  MDP,
  MarkovChain,
  MM1Queue,
  POMDP,
  RandomWalkGraph,
  gibbsSampler,
  inverse,
  matrixMultiply,
  matrixPower,
  metropolisHastings,
  normalizeDistribution,
  pagerank,
  solveLinearSystem,
} from "../index.ts";

function expectClose(actual: number, expected: number, tolerance = 1e-8) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

function sum(values: Iterable<number>) {
  return Array.from(values).reduce((total, value) => total + value, 0);
}

function expectDistribution(distribution: Record<string, number>, tolerance = 1e-8) {
  for (const value of Object.values(distribution)) {
    expect(value).toBeGreaterThanOrEqual(-tolerance);
    expect(value).toBeLessThanOrEqual(1 + tolerance);
  }
  expectClose(sum(Object.values(distribution)), 1, tolerance);
}

describe("core utility edge cases", () => {
  test("rejects singular systems, bad dimensions, and invalid distributions", () => {
    expect(() => inverse([
      [1, 2],
      [2, 4],
    ])).toThrow(/singular/i);

    expect(() => solveLinearSystem([
      [1, 2],
      [2, 4],
    ], [1, 2])).toThrow(/singular/i);

    expect(() => matrixMultiply([[1, 2]], [[1, 2]])).toThrow(/dimensions/i);
    expect(() => matrixPower([[1]], -1)).toThrow(/exponent/i);
    expect(() => normalizeDistribution({ A: 0, B: 0 })).toThrow(/positive/i);
    expect(() => normalizeDistribution({ A: -1, B: 2 })).toThrow(/nonnegative/i);
  });
});

describe("Markov chain edge cases", () => {
  test("rejects invalid construction and unknown states", () => {
    expect(() => MarkovChain.from({
      A: { A: 0.4 },
      B: { B: 1 },
    })).toThrow(/sum to 1/i);

    expect(() => MarkovChain.from<"A" | "B">({
      A: { A: 0.5, C: 0.5 },
      B: { B: 1 },
    } as any)).toThrow(/unknown destination/i);

    expect(() => MarkovChain.fromMatrix(["A", "A"], [
      [1, 0],
      [0, 1],
    ])).toThrow(/duplicate/i);

    const chain = MarkovChain.from({
      A: { A: 1 },
      B: { A: 1 },
    });
    expect(() => chain.transitionProbability("A", "Missing" as "A")).toThrow(/unknown state/i);
    expect(() => chain.distributionAfter({ A: 0.7, B: 0.7 }, 1)).toThrow(/sum to 1/i);
    expect(() => chain.simulate("A", -1)).toThrow(/steps/i);
  });

  test("supports optional row normalization with strict probability checks", () => {
    const chain = MarkovChain.from({
      A: { A: 2, B: 2 },
      B: { A: 1, B: 3 },
    }, { normalize: true });

    expectClose(chain.transitionProbability("A", "A"), 0.5);
    expectClose(chain.transitionProbability("A", "B"), 0.5);
    expectClose(chain.transitionProbability("B", "B"), 0.75);
  });

  test("classifies reducible chains and detects periodic non-aperiodic chains", () => {
    const reducible = MarkovChain.from({
      A: { A: 1 },
      B: { B: 1 },
      C: { A: 0.5, B: 0.5 },
    });

    expect(reducible.isIrreducible()).toBe(false);
    const classification = reducible.classify();
    expect(classification.A.recurrent).toBe(true);
    expect(classification.B.recurrent).toBe(true);
    expect(classification.C.transient).toBe(true);
    expect(classification.A.absorbing).toBe(true);
    expect(classification.B.absorbing).toBe(true);

    const periodic = MarkovChain.from({
      A: { B: 1 },
      B: { A: 1 },
    });
    expect(periodic.isIrreducible()).toBe(true);
    expect(periodic.isAperiodic()).toBe(false);
    expect(periodic.period("A")).toBe(2);
    expect(periodic.distributionAfter({ A: 1 }, 3)).toEqual({ A: 0, B: 1 });
    expect(() => periodic.stationaryByPower({ maxIterations: 0 })).toThrow(/did not converge/i);
  });
});

describe("absorbing chain edge cases", () => {
  test("rejects chains without absorbing states and keeps absorption rows normalized", () => {
    expect(() => AbsorbingChain.from({
      A: { B: 1 },
      B: { A: 1 },
    })).toThrow(/absorbing/i);

    const chain = AbsorbingChain.from({
      Start: { Retry: 0.4, Done: 0.6 },
      Retry: { Start: 0.5, Failed: 0.5 },
      Done: { Done: 1 },
      Failed: { Failed: 1 },
    });

    const probabilities = chain.absorptionProbabilities();
    expectDistribution(probabilities.Start);
    expectDistribution(probabilities.Retry);
    expectDistribution(probabilities.Done);
    expectDistribution(probabilities.Failed);
  });
});

describe("CTMC edge cases", () => {
  test("rejects invalid generators and non-convergent transition settings", () => {
    expect(() => CTMC.fromGenerator({
      A: { A: -1, B: -0.5 },
      B: { A: 0.5, B: -0.5 },
    })).toThrow(/off-diagonal/i);

    expect(() => CTMC.fromGenerator({
      A: { A: -1, B: 0.25 },
      B: { A: 0.5, B: -0.5 },
    })).toThrow(/sum to 0/i);

    expect(() => CTMC.fromGenerator({
      A: { A: 0.1, B: -0.1 },
      B: { A: 0.5, B: -0.5 },
    })).toThrow(/diagonal|off-diagonal/i);

    expect(() => CTMC.fromGenerator<"A" | "B">({
      A: { A: -1, B: 1, Missing: 0 },
      B: { A: 1, B: -1 },
    } as any)).toThrow(/unknown destination/i);

    const ctmc = CTMC.fromGenerator({
      Up: { Up: -0.1, Down: 0.1 },
      Down: { Up: 0.4, Down: -0.4 },
    });
    expect(() => ctmc.transitionMatrix(-1)).toThrow(/time/i);
    expect(() => ctmc.transitionMatrix(1, { maxTerms: 0 })).toThrow(/did not converge/i);
  });
});

describe("HMM edge cases", () => {
  test("rejects invalid configs, unknown observations, and zero-probability sequences", () => {
    expect(() => HiddenMarkovModel.from({
      states: ["A", "B"],
      observations: ["x"],
      initial: { A: 1, B: 0 },
      transition: {
        A: { A: 1 },
        B: { B: 1 },
      },
      emission: {
        A: { x: 1 },
        B: {},
      },
    })).toThrow(/positive|sum to 1/i);

    const hmm = HiddenMarkovModel.from({
      states: ["A", "B"],
      observations: ["x", "y"],
      initial: { A: 1, B: 0 },
      transition: {
        A: { A: 1, B: 0 },
        B: { A: 0, B: 1 },
      },
      emission: {
        A: { x: 1, y: 0 },
        B: { x: 0, y: 1 },
      },
    });

    expect(() => hmm.forward(["missing" as "x"])).toThrow(/unknown observation/i);
    expect(() => hmm.viterbi(["missing" as "x"])).toThrow(/unknown observation/i);
    expect(() => hmm.sequenceProbability(["y"])).toThrow(/zero probability/i);
  });
});

describe("MDP and POMDP edge cases", () => {
  const mdp = MDP.from({
    states: ["Low", "High"],
    actions: ["Order", "Hold"],
    discount: 0.9,
    transition: {
      Low: {
        Order: { High: 1 },
        Hold: { Low: 1 },
      },
      High: {
        Order: { High: 1 },
        Hold: { Low: 0.5, High: 0.5 },
      },
    },
    reward: {
      Low: { Order: 1, Hold: -1 },
      High: { Order: 0, Hold: 2 },
    },
  });

  test("rejects invalid MDP configs and invalid runtime inputs", () => {
    expect(() => MDP.from({
      states: ["Low"],
      actions: ["Hold"],
      discount: 1,
      transition: { Low: { Hold: { Low: 1 } } },
      reward: { Low: { Hold: 1 } },
    })).toThrow(/discount/i);

    expect(() => MDP.from({
      states: ["Low"],
      actions: ["Hold"],
      discount: 0.9,
      transition: { Low: { Hold: { Low: 0.5 } } },
      reward: { Low: { Hold: 1 } },
    })).toThrow(/sum to 1/i);

    const invalidPolicy = {
      Low: "Cancel",
      High: "Hold",
    } as unknown as Record<"Low" | "High", "Order" | "Hold">;
    expect(() => mdp.evaluatePolicy(invalidPolicy)).toThrow(/unknown action/i);
    expect(() => mdp.simulate("Missing" as "Low", { Low: "Order", High: "Hold" }, 1)).toThrow(/unknown state/i);
    expect(() => mdp.valueIteration({ maxIterations: 0 })).toThrow(/did not converge/i);
  });

  test("rejects invalid POMDP configs, invalid observations, and impossible belief updates", () => {
    expect(() => POMDP.from({
      states: ["Hall"],
      actions: ["Move"],
      observations: ["see-wall"],
      transition: { Hall: { Move: { Hall: 1 } } },
      observation: { Hall: { Move: {} } },
    })).toThrow(/positive|sum to 1/i);

    const pomdp = POMDP.from({
      states: ["Hall", "Door"],
      actions: ["Move"],
      observations: ["see-door", "impossible"],
      transition: {
        Hall: { Move: { Hall: 1, Door: 0 } },
        Door: { Move: { Hall: 0, Door: 1 } },
      },
      observation: {
        Hall: { Move: { "see-door": 1, impossible: 0 } },
        Door: { Move: { "see-door": 1, impossible: 0 } },
      },
    });

    expect(() => pomdp.updateBelief({
      belief: { Hall: 1, Door: 0 },
      action: "Teleport" as "Move",
      observation: "see-door",
    })).toThrow(/unknown action/i);

    expect(() => pomdp.updateBelief({
      belief: { Hall: 1, Door: 0 },
      action: "Move",
      observation: "missing" as "see-door",
    })).toThrow(/unknown observation/i);

    expect(() => pomdp.updateBelief({
      belief: { Hall: 1, Door: 0 },
      action: "Move",
      observation: "impossible",
    })).toThrow(/zero probability/i);
  });
});

describe("graph and PageRank edge cases", () => {
  test("handles dangling nodes and rejects invalid ranking options", () => {
    const graph = RandomWalkGraph.from<"Source" | "Sink">({
      Source: ["Sink"],
      Sink: [],
    });

    const transition = graph.transitionMatrix();
    const sinkIndex = graph.nodes.indexOf("Sink");
    expect(transition[sinkIndex]![sinkIndex]).toBe(1);
    expect(() => graph.walk("Missing" as "Source", 1)).toThrow(/unknown graph node/i);

    const ranks = pagerank<"Source" | "Sink">({
      Source: ["Sink"],
      Sink: [],
    });
    expectDistribution(ranks);
    expect(ranks.Sink).toBeGreaterThan(ranks.Source);

    expect(() => pagerank<"A" | "B">({ A: ["B"], B: [] }, { damping: 1.5 })).toThrow(/damping/i);
    expect(() => pagerank<"A" | "B">({ A: ["B"], B: ["A"] }, { maxIterations: 0 })).toThrow(/did not converge/i);
  });
});

describe("queue edge cases", () => {
  test("rejects unstable queues and invalid birth-death rates", () => {
    expect(() => new MM1Queue({ arrivalRate: 5, serviceRate: 5 })).toThrow(/unstable/i);
    expect(() => new MM1Queue({ arrivalRate: -1, serviceRate: 5 })).toThrow(/arrivalRate/i);
    expect(() => new MM1Queue({ arrivalRate: 1, serviceRate: 0 })).toThrow(/serviceRate/i);
    expect(() => new MM1Queue({ arrivalRate: 1, serviceRate: 5 }).stationaryProbability(-1)).toThrow(/state/i);

    const invalid = new BirthDeathProcess({
      birthRate: () => 1,
      deathRate: () => 0,
    });
    expect(() => invalid.stationaryDistribution(2)).toThrow(/death rate/i);
  });
});

describe("MCMC edge cases", () => {
  test("rejects invalid run options and unsupported summaries", () => {
    const sampler = metropolisHastings({
      initial: 0,
      logTarget: (x: number) => -0.5 * x * x,
      proposal: (x: number) => x,
    });

    expect(() => sampler.run({ iterations: 0 })).toThrow(/iterations/i);
    expect(() => sampler.run({ iterations: 10, burnIn: 10 })).toThrow(/burnIn/i);
    expect(() => sampler.run({ iterations: 10, thin: 0 })).toThrow(/thin/i);

    expect(() => gibbsSampler({ initial: { x: 0 }, steps: [] })).toThrow(/conditional step/i);

    const result = gibbsSampler({
      initial: { x: 0 },
      steps: [{ key: "x", sample: () => 1 }],
    }).run({ iterations: 3 });
    expect(() => result.mean()).toThrow(/number-valued/i);
  });
});

describe("distribution invariants across implemented modules", () => {
  test("returns normalized probabilities from public distribution APIs", () => {
    const chain = MarkovChain.from({
      A: { A: 0.25, B: 0.75 },
      B: { A: 0.5, B: 0.5 },
    });
    expectDistribution(chain.step({ A: 1, B: 0 }));
    expectDistribution(chain.distributionAfter({ A: 1, B: 0 }, 5));
    expectDistribution(chain.stationary());
    for (const row of chain.nStep(4)) {
      expectClose(sum(row), 1);
    }

    const ctmc = CTMC.fromGenerator({
      Up: { Up: -0.1, Down: 0.1 },
      Down: { Up: 0.4, Down: -0.4 },
    });
    expectDistribution(ctmc.stationary());
    for (const row of ctmc.transitionMatrix(3)) {
      expectClose(sum(row), 1);
    }

    const hmm = HiddenMarkovModel.from({
      states: ["Healthy", "Sick"],
      observations: ["normal", "fever"],
      initial: { Healthy: 0.8, Sick: 0.2 },
      transition: {
        Healthy: { Healthy: 0.7, Sick: 0.3 },
        Sick: { Healthy: 0.4, Sick: 0.6 },
      },
      emission: {
        Healthy: { normal: 0.9, fever: 0.1 },
        Sick: { normal: 0.2, fever: 0.8 },
      },
    });
    expectDistribution(hmm.forward(["normal", "fever"]).posterior);

    const pomdp = POMDP.from({
      states: ["Hall", "Door"],
      actions: ["Move"],
      observations: ["see-door", "see-wall"],
      transition: {
        Hall: { Move: { Hall: 0.7, Door: 0.3 } },
        Door: { Move: { Hall: 0.2, Door: 0.8 } },
      },
      observation: {
        Hall: { Move: { "see-door": 0.2, "see-wall": 0.8 } },
        Door: { Move: { "see-door": 0.9, "see-wall": 0.1 } },
      },
    });
    expectDistribution(pomdp.updateBelief({
      belief: { Hall: 0.6, Door: 0.4 },
      action: "Move",
      observation: "see-door",
    }));

    expectDistribution(pagerank({
      Home: ["Docs"],
      Docs: ["Home", "API"],
      API: [],
    }));

    const queueDistribution = new BirthDeathProcess({
      birthRate: () => 2,
      deathRate: (state) => (state === 0 ? 0 : 5),
    }).stationaryDistribution(5);
    expectClose(sum(Object.values(queueDistribution)), 1);
  });
});
