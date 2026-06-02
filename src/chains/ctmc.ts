import {
  DEFAULT_TOLERANCE,
  type Matrix,
  type Rng,
  addMatrices,
  assertGeneratorMatrix,
  cloneMatrix,
  identity,
  matrixMultiply,
  sampleIndex,
  scaleMatrix,
  solveLinearSystem,
  uniqueValues,
  vectorToDistribution,
} from "./core.ts";

export type GeneratorTransitions<S extends string = string> = Record<S, Partial<Record<S, number>>>;

export interface CTMCSimulationEvent<S extends string> {
  state: S;
  time: number;
}

export class CTMC<S extends string> {
  readonly states: S[];
  readonly generator: Matrix;
  private readonly indexByState: Map<S, number>;
  private readonly tolerance: number;

  constructor(states: readonly S[], generator: Matrix, tolerance = DEFAULT_TOLERANCE) {
    this.states = uniqueValues(states, "state");
    this.generator = cloneMatrix(generator);
    this.tolerance = tolerance;
    if (this.states.length !== this.generator.length) {
      throw new Error("State count must match generator matrix size");
    }
    assertGeneratorMatrix(this.generator, tolerance);
    this.indexByState = new Map(this.states.map((state, index) => [state, index]));
  }

  static fromGenerator<S extends string>(
    generator: GeneratorTransitions<S>,
    options: { tolerance?: number } = {},
  ): CTMC<S> {
    const states = Object.keys(generator) as S[];
    const stateSet = new Set(states);
    const matrix = states.map((from) => {
      const row = generator[from] ?? {};
      for (const to of Object.keys(row) as S[]) {
        if (!stateSet.has(to)) {
          throw new Error(`Unknown destination state: ${String(to)}`);
        }
      }
      return states.map((to) => row[to] ?? 0);
    });
    return new CTMC(states, matrix, options.tolerance);
  }

  transitionMatrix(time: number, options: { tolerance?: number; maxTerms?: number } = {}): Matrix {
    if (!Number.isFinite(time) || time < 0) {
      throw new Error(`Time must be nonnegative; received ${time}`);
    }

    const size = this.states.length;
    const maxExitRate = Math.max(...this.generator.map((row, i) => -row[i]!));
    if (maxExitRate <= this.tolerance || time === 0) {
      return identity(size);
    }

    const lambdaT = maxExitRate * time;
    const embedded = addMatrices(identity(size), scaleMatrix(this.generator, 1 / maxExitRate));
    let termMatrix = identity(size);
    let poissonWeight = Math.exp(-lambdaT);
    let result = scaleMatrix(termMatrix, poissonWeight);
    const tolerance = options.tolerance ?? 1e-14;
    const maxTerms = options.maxTerms ?? 10_000;

    for (let k = 1; k <= maxTerms; k++) {
      termMatrix = matrixMultiply(termMatrix, embedded);
      poissonWeight *= lambdaT / k;
      result = addMatrices(result, scaleMatrix(termMatrix, poissonWeight));

      if (poissonWeight < tolerance && k > lambdaT) {
        return normalizeRows(result);
      }
    }

    throw new Error(`CTMC transition matrix did not converge in ${maxTerms} terms`);
  }

  stationary(): Record<S, number> {
    const n = this.states.length;
    const coefficients = Array.from({ length: n }, (_, row) =>
      Array.from({ length: n }, (_unused, column) => this.generator[column]![row]!),
    );
    coefficients[n - 1] = Array(n).fill(1);
    const rhs = Array(n).fill(0) as number[];
    rhs[n - 1] = 1;

    const solution = solveLinearSystem(coefficients, rhs, this.tolerance)
      .map((value) => (Math.abs(value) < this.tolerance ? 0 : value));
    const total = solution.reduce((acc, value) => acc + value, 0);
    return vectorToDistribution(this.states, solution.map((value) => value / total));
  }

  simulate(start: S, horizon: number, options: { rng?: Rng } = {}): CTMCSimulationEvent<S>[] {
    const startIndex = this.indexOf(start);
    if (!Number.isFinite(horizon) || horizon < 0) {
      throw new Error(`Simulation horizon must be nonnegative; received ${horizon}`);
    }

    const events: CTMCSimulationEvent<S>[] = [{ state: start, time: 0 }];
    let currentIndex = startIndex;
    let time = 0;

    while (time < horizon) {
      const row = this.generator[currentIndex]!;
      const exitRate = -row[currentIndex]!;
      if (exitRate <= this.tolerance) break;

      const rng = options.rng;
      const hold = rng?.exponential(exitRate) ?? -Math.log(Math.max(Math.random(), Number.MIN_VALUE)) / exitRate;
      time += hold;
      if (time > horizon) break;

      const weights = row.map((rate, index) => (index === currentIndex ? 0 : Math.max(0, rate)));
      currentIndex = sampleIndex(weights, options.rng);
      events.push({ state: this.states[currentIndex]!, time });
    }

    return events;
  }

  private indexOf(state: S): number {
    const index = this.indexByState.get(state);
    if (index === undefined) {
      throw new Error(`Unknown state: ${String(state)}`);
    }
    return index;
  }
}

function normalizeRows(matrix: Matrix): Matrix {
  return matrix.map((row) => {
    const cleaned = row.map((value) => (Math.abs(value) < DEFAULT_TOLERANCE ? 0 : Math.max(0, value)));
    const total = cleaned.reduce((acc, value) => acc + value, 0);
    if (total <= 0) return cleaned;
    return cleaned.map((value) => value / total);
  });
}
