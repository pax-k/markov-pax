import { describe, expect, test } from "bun:test";
import {
  CTMC,
  HiddenMarkovModel,
  MDP,
  MarkovChain,
  MathRandomRng,
  MM1Queue,
  SeededRng,
  addMatrices,
  assertFiniteNumber,
  assertProbability,
  assertRectangularMatrix,
  assertSquareMatrix,
  distributionToVector,
  identity,
  matrixVectorMultiply,
  metropolisHastings,
  rngOrDefault,
  rowVectorMatrixMultiply,
  sampleIndex,
  scaleMatrix,
  subtractMatrices,
  transpose,
  vectorDistance,
  vectorToDistribution,
} from "../index.ts";

function expectClose(actual: number, expected: number, tolerance = 1e-8) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

class SequenceMathRandomRng extends MathRandomRng {
  private readonly values: number[];

  constructor(values: number[]) {
    super();
    this.values = [...values];
  }

  override next(): number {
    return this.values.shift() ?? 0.75;
  }
}

describe("coverage completion for core utilities", () => {
  test("covers MathRandomRng random, normal, and exponential paths", () => {
    const random = new MathRandomRng().next();
    expect(random).toBeGreaterThanOrEqual(0);
    expect(random).toBeLessThan(1);

    const normal = new SequenceMathRandomRng([0, 0.25, 0, 0.5]).normal(10, 2);
    expectClose(normal, 10 - 2 * Math.sqrt(-2 * Math.log(0.25)));

    const exponential = new SequenceMathRandomRng([0, 0.5]).exponential(2);
    expectClose(exponential, -Math.log(0.5) / 2);

    expect(() => new MathRandomRng().exponential(0)).toThrow(/positive/i);

    const seeded = new SeededRng();
    expect(Number.isFinite(seeded.normal())).toBe(true);
    expect(Number.isFinite(seeded.normal())).toBe(true);
    const seededHold = seeded.exponential(2);
    expect(Number.isFinite(seededHold)).toBe(true);
    expect(seededHold).toBeGreaterThan(0);
    expect(() => seeded.exponential(0)).toThrow(/positive/i);
  });

  test("covers transpose and matrix-vector multiplication", () => {
    expect(transpose([
      [1, 2, 3],
      [4, 5, 6],
    ])).toEqual([
      [1, 4],
      [2, 5],
      [3, 6],
    ]);

    expect(matrixVectorMultiply([
      [1, 2],
      [3, 4],
    ], [2, 1])).toEqual([4, 10]);

    expect(() => matrixVectorMultiply([[1, 2]], [1])).toThrow(/dimensions/i);
  });

  test("covers exported utility validation and fallback paths", () => {
    const provided = new MathRandomRng();
    expect(rngOrDefault(provided)).toBe(provided);
    expect(rngOrDefault().next()).toBeGreaterThanOrEqual(0);

    expect(() => assertFiniteNumber(Number.NaN, "value")).toThrow(/finite/i);
    expect(() => assertProbability(Number.NaN)).toThrow(/probability/i);
    expect(() => assertRectangularMatrix([])).toThrow(/row/i);
    expect(() => assertRectangularMatrix([[]])).toThrow(/column/i);
    expect(() => assertRectangularMatrix([[1], [1, 2]])).toThrow(/rectangular/i);
    expect(() => assertRectangularMatrix([[Number.NaN]])).toThrow(/finite/i);
    expect(() => assertSquareMatrix([[1, 2]])).toThrow(/square/i);
    expect(() => identity(-1)).toThrow(/nonnegative/i);
    expect(() => distributionToVector(["A"], { A: -1 })).toThrow(/nonnegative/i);
    expect(() => vectorToDistribution(["A"], [1, 0])).toThrow(/length/i);
    expect(() => rowVectorMatrixMultiply([1], [[1], [2]])).toThrow(/dimensions/i);
    expect(() => subtractMatrices([[1]], [[1, 2]])).toThrow(/dimensions/i);
    expect(() => scaleMatrix([[1]], Number.NaN)).toThrow(/finite/i);
    expect(() => addMatrices([[1]], [[1, 2]])).toThrow(/dimensions/i);
    expect(() => vectorDistance([1], [1, 2])).toThrow(/length/i);

    expect(sampleIndex([0.2, 0.8], {
      next: () => 1,
      normal: () => 0,
      exponential: () => 0,
    })).toBe(1);
    expect(() => sampleIndex([])).toThrow(/empty/i);
    expect(() => sampleIndex([-1])).toThrow(/nonnegative/i);
    expect(() => sampleIndex([0, 0])).toThrow(/positive/i);
  });
});

describe("coverage completion for finite Markov chains", () => {
  test("covers stepFrom, fromVector, and default-RNG simulation paths", () => {
    const chain = MarkovChain.from({
      A: { A: 0.2, B: 0.8 },
      B: { A: 0.5, B: 0.5 },
    });

    expect(chain.stepFrom("A")).toEqual({ A: 0.2, B: 0.8 });
    expect(chain.fromVector([0.3, 0.7])).toEqual({ A: 0.3, B: 0.7 });
    expect(chain.toVector({ A: 2, B: 1 }, { normalize: true })).toEqual([2 / 3, 1 / 3]);
    expect(() => chain.stepFrom("Missing" as "A")).toThrow(/unknown state/i);

    const deterministic = MarkovChain.from({
      A: { B: 1 },
      B: { B: 1 },
    });
    expect(deterministic.simulate("A", 1)).toEqual(["A", "B"]);
  });
});

describe("coverage completion for CTMC simulation", () => {
  test("covers default RNG holding times and unknown start validation", () => {
    const ctmc = CTMC.fromGenerator({
      Up: { Up: -1, Down: 1 },
      Down: { Down: 0 },
    });

    const path = ctmc.simulate("Up", 0.001);
    expect(path[0]).toEqual({ state: "Up", time: 0 });
    expect(path.every((event) => event.time >= 0)).toBe(true);
    expect(() => ctmc.simulate("Missing" as "Up", 1)).toThrow(/unknown state/i);
  });

  test("covers constructor mismatch and zero-generator transition branches", () => {
    expect(() => new CTMC(["A", "B"], [[0]])).toThrow(/match/i);

    const frozen = CTMC.fromGenerator({
      Still: { Still: 0 },
    });
    expect(frozen.transitionMatrix(5)).toEqual([[1]]);
    expect(frozen.transitionMatrix(0)).toEqual([[1]]);
    expect(frozen.simulate("Still", 10)).toEqual([{ state: "Still", time: 0 }]);
    expect(() => frozen.simulate("Still", -1)).toThrow(/horizon/i);

    const fast = CTMC.fromGenerator({
      A: { A: -1000, B: 1000 },
      B: { B: 0 },
    });
    const fastPath = fast.simulate("A", 1, { rng: new SeededRng(1) });
    expect(fastPath.map((event) => event.state)).toEqual(["A", "B"]);

    const degrading = CTMC.fromGenerator({
      Working: { Working: -1, Failed: 1 },
      Failed: { Working: 0, Failed: 0 },
    });
    expect(degrading.stationary()).toEqual({ Working: 0, Failed: 1 });
  });
});

describe("coverage completion for HMM backward recursion", () => {
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

  test("computes beta values and rejects invalid backward inputs", () => {
    const beta = hmm.backward(["normal", "fever", "fever"]);

    expectClose(beta[2]![0]!, 1);
    expectClose(beta[2]![1]!, 1);
    expectClose(beta[1]![0]!, 0.215);
    expectClose(beta[1]![1]!, 0.38);
    expectClose(beta[0]![0]!, 0.075925);
    expectClose(beta[0]![1]!, 0.1411);

    expect(() => hmm.backward([])).toThrow(/empty|not be empty/i);
    expect(() => hmm.backward(["missing" as "normal"])).toThrow(/unknown observation/i);
  });
});

describe("coverage completion for MDP policy iteration", () => {
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

  test("computes the same optimal policy as value iteration and rejects non-convergence", () => {
    const valueResult = mdp.valueIteration();
    const policyResult = mdp.policyIteration();

    expect(policyResult.policy).toEqual(valueResult.policy);
    expect(policyResult.policy.Low).toBe("Order");
    expect(policyResult.policy.High).toBe("Hold");
    expect(policyResult.values.Low).toBeGreaterThan(0);
    expect(policyResult.values.High).toBeGreaterThan(policyResult.values.Low);
    expect(policyResult.delta).toBe(0);

    expect(() => mdp.policyIteration({ maxIterations: 0 })).toThrow(/did not converge/i);
  });
});

describe("coverage completion for MCMC and queue metrics", () => {
  test("covers negative burn-in validation", () => {
    const sampler = metropolisHastings({
      initial: 0,
      logTarget: (x: number) => -0.5 * x * x,
      proposal: (x: number) => x,
    });

    expect(() => sampler.run({ iterations: 10, burnIn: -1 })).toThrow(/burnIn/i);
  });

  test("covers M/M/1 expected waiting time metrics", () => {
    const queue = new MM1Queue({ arrivalRate: 2, serviceRate: 5 });

    expectClose(queue.expectedTimeInSystem(), 1 / 3);
    expectClose(queue.expectedTimeInQueue(), 0.4 / 3);
  });
});
