import {
  type Distribution,
  type Rng,
  assertFiniteNumber,
  rngOrDefault,
  sampleIndex,
} from "../shared/core.ts";

export interface TransitionKernel<S> {
  sample(state: S, rng: Rng): S;
}

export interface MarkovProcess<S> {
  initial: S;
  kernel: TransitionKernel<S>;
}

export class KernelChain<S> {
  readonly kernel: TransitionKernel<S>;

  constructor(kernel: TransitionKernel<S>) {
    this.kernel = kernel;
  }

  step(state: S, options: { rng?: Rng } = {}): S {
    return this.kernel.sample(state, rngOrDefault(options.rng));
  }

  simulate(initial: S, steps: number, options: { rng?: Rng } = {}): S[] {
    return simulateKernel(this.kernel, initial, steps, options);
  }
}

export function finiteKernel<S extends string>(
  transitions: Record<S, Partial<Record<S, number>>>,
): TransitionKernel<S> {
  const states = Object.keys(transitions) as S[];
  if (states.length === 0) {
    throw new Error("Finite kernel requires at least one state");
  }

  return {
    sample(state: S, rng: Rng): S {
      const row = transitions[state];
      if (!row) {
        throw new Error(`Unknown kernel state: ${String(state)}`);
      }
      const weights = states.map((next) => row[next] ?? 0);
      return states[sampleIndex(weights, rng)]!;
    },
  };
}

export function simulateKernel<S>(
  kernel: TransitionKernel<S>,
  initial: S,
  steps: number,
  options: { rng?: Rng } = {},
): S[] {
  if (!Number.isInteger(steps) || steps < 0) {
    throw new Error(`Steps must be a nonnegative integer; received ${steps}`);
  }

  const rng = rngOrDefault(options.rng);
  const path: S[] = [initial];
  let current = initial;
  for (let step = 0; step < steps; step++) {
    current = kernel.sample(current, rng);
    path.push(current);
  }
  return path;
}

export function empiricalDistribution<S extends string>(path: readonly S[]): Distribution<S> {
  if (path.length === 0) {
    throw new Error("Path must contain at least one state");
  }

  const counts: Partial<Record<S, number>> = {};
  for (const state of path) {
    counts[state] = (counts[state] ?? 0) + 1;
  }

  const result: Partial<Record<S, number>> = {};
  for (const [state, count] of Object.entries(counts) as [S, number][]) {
    result[state] = count / path.length;
  }
  return result as Distribution<S>;
}

export function estimateExpectation<S>(
  path: readonly S[],
  observable: (state: S) => number,
): number {
  if (path.length === 0) {
    throw new Error("Path must contain at least one state");
  }

  let total = 0;
  for (const state of path) {
    const value = observable(state);
    assertFiniteNumber(value, "Observable value");
    total += value;
  }
  return total / path.length;
}
