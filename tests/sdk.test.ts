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
  SeededRng,
  gibbsSampler,
  identity,
  inverse,
  matrixMultiply,
  matrixPower,
  metropolisHastings,
  normalizeDistribution,
  pagerank,
  solveLinearSystem,
  vectorDistance,
} from "../index.ts";

function expectClose(actual: number, expected: number, tolerance = 1e-8) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

function sum(values: Iterable<number>) {
  return Array.from(values).reduce((total, value) => total + value, 0);
}

describe("core math utilities", () => {
  test("multiplies, powers, inverts, solves, and normalizes", () => {
    expect(matrixMultiply(
      [
        [1, 2],
        [3, 4],
      ],
      [
        [2, 0],
        [1, 2],
      ],
    )).toEqual([
      [4, 4],
      [10, 8],
    ]);

    expect(matrixPower(
      [
        [0.5, 0.5],
        [0.25, 0.75],
      ],
      2,
    )).toEqual([
      [0.375, 0.625],
      [0.3125, 0.6875],
    ]);

    const inv = inverse([
      [4, 7],
      [2, 6],
    ]);
    expectClose(inv[0]![0]!, 0.6);
    expectClose(inv[0]![1]!, -0.7);
    expectClose(inv[1]![0]!, -0.2);
    expectClose(inv[1]![1]!, 0.4);

    const solution = solveLinearSystem(
      [
        [3, 2],
        [1, 2],
      ],
      [5, 5],
    );
    expectClose(solution[0]!, 0);
    expectClose(solution[1]!, 2.5);

    expect(identity(2)).toEqual([
      [1, 0],
      [0, 1],
    ]);

    const normalized = normalizeDistribution({ A: 2, B: 3 });
    expectClose(normalized.A, 0.4);
    expectClose(normalized.B, 0.6);
    expectClose(vectorDistance([0.4, 0.6], [0.1, 0.9]), 0.6);
  });

  test("rejects invalid probabilities", () => {
    expect(() => MarkovChain.from({
      A: { A: 1.2, B: -0.2 },
      B: { A: 0.5, B: 0.5 },
    })).toThrow(/probability/i);
  });
});

describe("finite Markov chains", () => {
  const weather = MarkovChain.from({
    Sunny: { Sunny: 0.7, Cloudy: 0.2, Rainy: 0.1 },
    Cloudy: { Sunny: 0.3, Cloudy: 0.4, Rainy: 0.3 },
    Rainy: { Sunny: 0.2, Cloudy: 0.3, Rainy: 0.5 },
  });

  test("forecasts weather and computes stationary behavior", () => {
    const forecast = weather.distributionAfter({ Sunny: 1 }, 2);
    expectClose(forecast.Sunny, 0.57);
    expectClose(forecast.Cloudy, 0.25);
    expectClose(forecast.Rainy, 0.18);

    expectClose(weather.probabilityAfter("Sunny", "Rainy", 2), 0.18);
    expectClose(weather.pathProbability(["Sunny", "Cloudy", "Rainy"]), 0.06);

    const stationary = weather.stationary();
    expectClose(sum(Object.values(stationary)), 1);
    expectClose(stationary.Sunny, 0.456521739, 1e-6);
    expectClose(stationary.Cloudy, 0.282608695, 1e-6);
    expectClose(stationary.Rainy, 0.260869565, 1e-6);

    const cloudyStart = weather.distributionAfter({ Cloudy: 1 }, 100);
    expect(vectorDistance(
      weather.toVector(cloudyStart),
      weather.toVector(stationary),
    )).toBeLessThan(1e-8);
  });

  test("classifies connectivity, period, and deterministic seeded simulation", () => {
    expect(weather.isIrreducible()).toBe(true);
    expect(weather.isAperiodic()).toBe(true);
    expect(weather.period("Sunny")).toBe(1);

    const path = weather.simulate("Sunny", 6, { rng: new SeededRng(123) });
    expect(path).toEqual(["Sunny", "Sunny", "Sunny", "Sunny", "Sunny", "Sunny", "Sunny"]);

    const classification = weather.classify();
    expect(classification.Sunny.recurrent).toBe(true);
    expect(classification.Cloudy.communicatingClass).toBe(0);
  });
});

describe("absorbing chains", () => {
  test("models customer success versus churn", () => {
    const chain = AbsorbingChain.from({
      Start: { Work: 0.8, Churn: 0.2 },
      Work: { Work: 0.6, Success: 0.3, Churn: 0.1 },
      Success: { Success: 1 },
      Churn: { Churn: 1 },
    });

    expect(chain.absorbingStates()).toEqual(["Success", "Churn"]);
    expect(chain.transientStates()).toEqual(["Start", "Work"]);

    const probs = chain.absorptionProbabilities();
    expectClose(probs.Start.Success, 0.6);
    expectClose(probs.Start.Churn, 0.4);
    expectClose(probs.Work.Success, 0.75);
    expectClose(probs.Work.Churn, 0.25);

    const times = chain.expectedTimeToAbsorption();
    expectClose(times.Start, 3);
    expectClose(times.Work, 2.5);
  });
});

describe("continuous-time Markov chains", () => {
  test("models server failure and repair availability", () => {
    const ctmc = CTMC.fromGenerator({
      Up: { Up: -0.1, Down: 0.1 },
      Down: { Up: 0.4, Down: -0.4 },
    });

    const transition = ctmc.transitionMatrix(2);
    for (const row of transition) {
      expectClose(sum(row), 1, 1e-8);
    }

    const stationary = ctmc.stationary();
    expectClose(stationary.Up, 0.8, 1e-8);
    expectClose(stationary.Down, 0.2, 1e-8);

    const path = ctmc.simulate("Up", 5, { rng: new SeededRng(9) });
    expect(path[0]!.state).toBe("Up");
    expect(path.every((event) => event.time >= 0)).toBe(true);
  });
});

describe("hidden Markov models", () => {
  test("detects sickness from fever-heavy observations", () => {
    const hmm = HiddenMarkovModel.from({
      states: ["Healthy", "Sick"],
      observations: ["normal", "dizzy", "fever"],
      initial: { Healthy: 0.8, Sick: 0.2 },
      transition: {
        Healthy: { Healthy: 0.7, Sick: 0.3 },
        Sick: { Healthy: 0.4, Sick: 0.6 },
      },
      emission: {
        Healthy: { normal: 0.8, dizzy: 0.15, fever: 0.05 },
        Sick: { normal: 0.1, dizzy: 0.3, fever: 0.6 },
      },
    });

    const probability = hmm.sequenceProbability(["normal", "fever", "fever"]);
    expect(probability).toBeGreaterThan(0);
    expect(probability).toBeLessThan(1);

    const forward = hmm.forward(["normal", "fever", "fever"]);
    expectClose(sum(Object.values(forward.posterior)), 1);

    const decoded = hmm.viterbi(["normal", "fever", "fever"]);
    expect(decoded.path.at(-1)).toBe("Sick");

    const sample = hmm.sample(3, { rng: new SeededRng(5) });
    expect(sample.states).toHaveLength(3);
    expect(sample.observations).toHaveLength(3);
  });
});

describe("MDPs and POMDPs", () => {
  test("finds an inventory replenishment policy", () => {
    const mdp = MDP.from({
      states: ["Low", "High"],
      actions: ["Order", "Hold"],
      discount: 0.9,
      transition: {
        Low: {
          Order: { High: 0.9, Low: 0.1 },
          Hold: { Low: 0.85, High: 0.15 },
        },
        High: {
          Order: { High: 0.95, Low: 0.05 },
          Hold: { High: 0.65, Low: 0.35 },
        },
      },
      reward: {
        Low: { Order: 1, Hold: -2 },
        High: { Order: 0, Hold: 3 },
      },
    });

    const result = mdp.valueIteration();
    expect(result.policy.Low).toBe("Order");
    expect(result.policy.High).toBe("Hold");

    const evaluation = mdp.evaluatePolicy(result.policy);
    expect(evaluation.Low).toBeGreaterThan(0);
    expect(evaluation.High).toBeGreaterThan(evaluation.Low);
  });

  test("updates a robot localization belief", () => {
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

    const updated = pomdp.updateBelief({
      belief: { Hall: 0.6, Door: 0.4 },
      action: "Move",
      observation: "see-door",
    });

    expectClose(sum(Object.values(updated)), 1);
    expect(updated.Door).toBeGreaterThan(updated.Hall);
  });
});

describe("graphs and PageRank", () => {
  test("walks graphs and ranks important pages", () => {
    const graph = RandomWalkGraph.from({
      Home: ["Docs", "Blog"],
      Docs: ["Home", "API"],
      Blog: ["Docs"],
      API: ["Docs"],
    });

    const transition = graph.transitionMatrix();
    for (const row of transition) {
      expectClose(sum(row), 1);
    }

    const walk = graph.walk("Home", 4, { rng: new SeededRng(2) });
    expect(walk[0]).toBe("Home");
    expect(walk).toHaveLength(5);

    const ranks = pagerank({
      Home: ["Docs", "Blog"],
      Docs: ["Home", "API"],
      Blog: ["Docs"],
      API: ["Docs"],
    });
    expectClose(sum(Object.values(ranks)), 1);
    expect(ranks.Docs).toBeGreaterThan(ranks.Blog);
  });
});

describe("queues", () => {
  test("computes M/M/1 queue metrics", () => {
    const queue = new MM1Queue({ arrivalRate: 2, serviceRate: 5 });
    expectClose(queue.rho(), 0.4);
    expectClose(queue.stationaryProbability(0), 0.6);
    expectClose(queue.stationaryProbability(3), 0.6 * 0.4 ** 3);
    expectClose(queue.expectedNumberInSystem(), 2 / 3);
    expectClose(queue.expectedNumberInQueue(), 0.2666666667, 1e-8);

    const birthDeath = new BirthDeathProcess({
      birthRate: () => 2,
      deathRate: (n) => (n === 0 ? 0 : 5),
    });
    const probs = birthDeath.stationaryDistribution(4);
    expectClose(sum(Object.values(probs)), 1);
    expect(probs[0]!).toBeGreaterThan(probs[4]!);
  });
});

describe("MCMC samplers", () => {
  test("samples a standard normal target with Metropolis-Hastings", () => {
    const sampler = metropolisHastings({
      initial: 0,
      logTarget: (x: number) => -0.5 * x * x,
      proposal: (x: number, rng) => x + rng.normal(0, 1),
      rng: new SeededRng(1234),
    });

    const result = sampler.run({ iterations: 12_000, burnIn: 2_000 });
    expect(result.samples).toHaveLength(10_000);
    expect(result.acceptanceRate).toBeGreaterThan(0.4);
    expect(result.acceptanceRate).toBeLessThan(0.9);
    expectClose(result.mean(), 0, 0.08);
    expectClose(result.variance(), 1, 0.15);
  });

  test("runs user-defined Gibbs conditionals", () => {
    const result = gibbsSampler({
      initial: { x: 0, y: 0 },
      steps: [
        {
          key: "x",
          sample: (state, rng) => 0.5 * state.y + rng.normal(0, 1),
        },
        {
          key: "y",
          sample: (state, rng) => 0.5 * state.x + rng.normal(0, 1),
        },
      ],
      rng: new SeededRng(42),
    }).run({ iterations: 200, burnIn: 50 });

    expect(result.samples).toHaveLength(150);
    expect(Number.isFinite(result.samples[0]!.x)).toBe(true);
    expect(Number.isFinite(result.samples[0]!.y)).toBe(true);
  });
});
