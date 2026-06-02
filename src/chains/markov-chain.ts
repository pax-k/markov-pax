import {
  DEFAULT_MAX_ITERATIONS,
  DEFAULT_TOLERANCE,
  type Distribution,
  type Matrix,
  type Rng,
  type WeightedTransitions,
  assertProbability,
  assertFiniteNumber,
  assertSquareMatrix,
  assertStochasticMatrix,
  cloneMatrix,
  distributionToVector,
  ensureKnown,
  matrixPower,
  rowVectorMatrixMultiply,
  sampleIndex,
  solveLinearSystem,
  uniqueValues,
  vectorDistance,
  vectorToDistribution,
} from "../shared/core.ts";

export interface MarkovChainOptions {
  normalize?: boolean;
  tolerance?: number;
}

export interface SimulateOptions {
  rng?: Rng;
}

export interface StationaryOptions {
  tolerance?: number;
  maxIterations?: number;
}

export interface StateClassification {
  recurrent: boolean;
  transient: boolean;
  absorbing: boolean;
  communicatingClass: number;
  period: number;
}

export class MarkovChain<S extends string> {
  readonly states: S[];
  readonly matrix: Matrix;
  private readonly indexByState: Map<S, number>;
  private readonly tolerance: number;

  constructor(states: readonly S[], transition: Matrix, options: MarkovChainOptions = {}) {
    this.states = uniqueValues(states, "state");
    this.matrix = options.normalize ? normalizeRows(transition) : cloneMatrix(transition);
    this.tolerance = options.tolerance ?? DEFAULT_TOLERANCE;

    if (this.states.length !== this.matrix.length) {
      throw new Error("State count must match transition matrix size");
    }
    assertStochasticMatrix(this.matrix, this.tolerance);

    this.indexByState = new Map(this.states.map((state, index) => [state, index]));
  }

  static from<S extends string>(
    transitions: WeightedTransitions<S>,
    options: MarkovChainOptions = {},
  ): MarkovChain<S> {
    const states = Object.keys(transitions) as S[];
    uniqueValues(states, "state");
    const stateSet = new Set(states);

    const matrix = states.map((from) => {
      const row = transitions[from] ?? {};
      for (const to of Object.keys(row) as S[]) {
        if (!stateSet.has(to)) {
          throw new Error(`Unknown destination state: ${String(to)}`);
        }
      }
      return states.map((to) => row[to] ?? 0);
    });

    return new MarkovChain(states, matrix, options);
  }

  static fromMatrix<S extends string>(
    states: readonly S[],
    matrix: Matrix,
    options: MarkovChainOptions = {},
  ): MarkovChain<S> {
    return new MarkovChain(states, matrix, options);
  }

  transitionProbability(from: S, to: S): number {
    return this.matrix[this.indexOf(from)]![this.indexOf(to)]!;
  }

  step(distribution: Partial<Distribution<S>>, options: { normalize?: boolean } = {}): Distribution<S> {
    const vector = distributionToVector(this.states, distribution, options);
    return vectorToDistribution(this.states, rowVectorMatrixMultiply(vector, this.matrix));
  }

  stepFrom(state: S): Distribution<S> {
    ensureKnown(this.states, state);
    const row = this.matrix[this.indexOf(state)]!;
    return vectorToDistribution(this.states, row);
  }

  distributionAfter(
    distribution: Partial<Distribution<S>>,
    steps: number,
    options: { normalize?: boolean } = {},
  ): Distribution<S> {
    if (!Number.isInteger(steps) || steps < 0) {
      throw new Error(`Steps must be a nonnegative integer; received ${steps}`);
    }
    let vector = distributionToVector(this.states, distribution, options);
    const powered = matrixPower(this.matrix, steps);
    vector = rowVectorMatrixMultiply(vector, powered);
    return vectorToDistribution(this.states, vector);
  }

  probabilityAfter(from: S, to: S, steps: number): number {
    if (!Number.isInteger(steps) || steps < 0) {
      throw new Error(`Steps must be a nonnegative integer; received ${steps}`);
    }
    return matrixPower(this.matrix, steps)[this.indexOf(from)]![this.indexOf(to)]!;
  }

  pathProbability(path: readonly S[], initial?: Partial<Distribution<S>>): number {
    if (path.length === 0) {
      throw new Error("Path must contain at least one state");
    }

    for (const state of path) {
      ensureKnown(this.states, state);
    }

    let probability = 1;
    if (initial) {
      const vector = distributionToVector(this.states, initial);
      probability *= vector[this.indexOf(path[0]!)]!;
    }

    for (let i = 0; i < path.length - 1; i++) {
      probability *= this.transitionProbability(path[i]!, path[i + 1]!);
    }
    return probability;
  }

  simulate(start: S, steps: number, options: SimulateOptions = {}): S[] {
    ensureKnown(this.states, start);
    if (!Number.isInteger(steps) || steps < 0) {
      throw new Error(`Steps must be a nonnegative integer; received ${steps}`);
    }

    const path: S[] = [start];
    let current = start;
    for (let step = 0; step < steps; step++) {
      const nextIndex = sampleIndex(this.matrix[this.indexOf(current)]!, options.rng);
      current = this.states[nextIndex]!;
      path.push(current);
    }
    return path;
  }

  nStep(steps: number): Matrix {
    return matrixPower(this.matrix, steps);
  }

  stationary(options: StationaryOptions = {}): Distribution<S> {
    const tolerance = options.tolerance ?? this.tolerance;
    const n = this.states.length;
    const coefficients: Matrix = Array.from({ length: n }, (_, row) =>
      Array.from({ length: n }, (_unused, column) => this.matrix[column]![row]! - (row === column ? 1 : 0)),
    );

    coefficients[n - 1] = Array(n).fill(1);
    const rhs = Array(n).fill(0) as number[];
    rhs[n - 1] = 1;

    let solution: number[];
    try {
      solution = solveLinearSystem(coefficients, rhs, tolerance);
    } catch {
      solution = this.stationaryByPower(options);
    }

    const cleaned = solution.map((value) => (Math.abs(value) < tolerance ? 0 : value));
    const total = cleaned.reduce((acc, value) => acc + value, 0);
    if (Math.abs(total) <= tolerance) {
      throw new Error("Could not compute stationary distribution");
    }

    return vectorToDistribution(this.states, cleaned.map((value) => value / total));
  }

  stationaryByPower(options: StationaryOptions = {}): number[] {
    const tolerance = options.tolerance ?? this.tolerance;
    const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;
    let current = Array(this.states.length).fill(1 / this.states.length) as number[];

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      const next = rowVectorMatrixMultiply(current, this.matrix);
      if (vectorDistance(current, next) <= tolerance) {
        return next;
      }
      current = next;
    }

    throw new Error(`Stationary distribution did not converge in ${maxIterations} iterations`);
  }

  isIrreducible(): boolean {
    return this.communicatingClasses().length === 1;
  }

  period(state: S): number {
    const index = this.indexOf(state);
    let gcdValue = 0;
    let power = cloneMatrix(this.matrix);
    const limit = Math.max(2, this.states.length * this.states.length * 2);

    for (let n = 1; n <= limit; n++) {
      if (power[index]![index]! > this.tolerance) {
        gcdValue = gcd(gcdValue, n);
        if (gcdValue === 1) return 1;
      }
      power = rowMatrixMultiplySquare(power, this.matrix);
    }

    return gcdValue === 0 ? 0 : gcdValue;
  }

  isAperiodic(): boolean {
    return this.states.every((state) => this.period(state) === 1);
  }

  classify(): Record<S, StateClassification> {
    const classes = this.communicatingClasses();
    const result: Partial<Record<S, StateClassification>> = {};

    for (let classIndex = 0; classIndex < classes.length; classIndex++) {
      const classMembers = classes[classIndex]!;
      const memberSet = new Set(classMembers);
      let closed = true;
      for (const state of classMembers) {
        const row = this.matrix[this.indexOf(state)]!;
        for (let toIndex = 0; toIndex < row.length; toIndex++) {
          if (row[toIndex]! > this.tolerance && !memberSet.has(this.states[toIndex]!)) {
            closed = false;
          }
        }
      }

      for (const state of classMembers) {
        const absorbing = this.transitionProbability(state, state) >= 1 - this.tolerance;
        result[state] = {
          recurrent: closed,
          transient: !closed,
          absorbing,
          communicatingClass: classIndex,
          period: this.period(state),
        };
      }
    }

    return result as Record<S, StateClassification>;
  }

  toVector(distribution: Partial<Distribution<S>>, options: { normalize?: boolean } = {}): number[] {
    return distributionToVector(this.states, distribution, options);
  }

  fromVector(vector: readonly number[]): Distribution<S> {
    return vectorToDistribution(this.states, vector);
  }

  private indexOf(state: S): number {
    const index = this.indexByState.get(state);
    if (index === undefined) {
      throw new Error(`Unknown state: ${String(state)}`);
    }
    return index;
  }

  private communicatingClasses(): S[][] {
    const n = this.states.length;
    const adjacency = this.matrix.map((row) =>
      row.map((value, index) => (value > this.tolerance ? index : -1)).filter((index) => index >= 0),
    );
    const reverse = Array.from({ length: n }, () => [] as number[]);
    for (let from = 0; from < n; from++) {
      for (const to of adjacency[from]!) {
        reverse[to]!.push(from);
      }
    }

    const order: number[] = [];
    const visited = new Set<number>();
    const dfs = (node: number) => {
      visited.add(node);
      for (const next of adjacency[node]!) {
        if (!visited.has(next)) dfs(next);
      }
      order.push(node);
    };

    for (let i = 0; i < n; i++) {
      if (!visited.has(i)) dfs(i);
    }

    visited.clear();
    const classes: S[][] = [];
    const reverseDfs = (node: number, members: number[]) => {
      visited.add(node);
      members.push(node);
      for (const next of reverse[node]!) {
        if (!visited.has(next)) reverseDfs(next, members);
      }
    };

    for (let i = order.length - 1; i >= 0; i--) {
      const node = order[i]!;
      if (visited.has(node)) continue;
      const members: number[] = [];
      reverseDfs(node, members);
      classes.push(members.map((index) => this.states[index]!));
    }

    return classes;
  }
}

function normalizeRows(matrix: Matrix): Matrix {
  assertSquareMatrix(matrix, "Transition matrix");
  return matrix.map((row, rowIndex) => {
    let total = 0;
    for (let column = 0; column < row.length; column++) {
      const value = row[column]!;
      assertFiniteNumber(value, `Transition weight at [${rowIndex}][${column}]`);
      if (value < 0) {
        throw new Error(`Transition weight at [${rowIndex}][${column}] must be nonnegative`);
      }
      total += value;
    }
    if (total <= 0) {
      throw new Error(`Transition matrix row ${rowIndex} must have positive total`);
    }
    return row.map((value) => value / total);
  });
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x;
}

function rowMatrixMultiplySquare(a: Matrix, b: Matrix): Matrix {
  const size = a.length;
  return Array.from({ length: size }, (_, i) =>
    Array.from({ length: size }, (_unused, j) => {
      let value = 0;
      for (let k = 0; k < size; k++) {
        value += a[i]![k]! * b[k]![j]!;
      }
      return value;
    }),
  );
}
