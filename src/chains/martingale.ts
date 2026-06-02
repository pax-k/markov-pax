import {
  DEFAULT_TOLERANCE,
  type Distribution,
  type Rng,
  assertFiniteNumber,
  solveLinearSystem,
} from "./core.ts";
import { MarkovChain } from "./markov-chain.ts";

export function harmonicResidual<S extends string>(
  chain: MarkovChain<S>,
  values: Partial<Record<S, number>>,
): Distribution<S> {
  const residuals: Partial<Record<S, number>> = {};
  for (const state of chain.states) {
    const current = valueFor(values, state);
    let expected = 0;
    for (const next of chain.states) {
      expected += chain.transitionProbability(state, next) * valueFor(values, next);
    }
    residuals[state] = expected - current;
  }
  return residuals as Distribution<S>;
}

export function isHarmonic<S extends string>(
  chain: MarkovChain<S>,
  values: Partial<Record<S, number>>,
  tolerance = DEFAULT_TOLERANCE,
): boolean {
  return (Object.values(harmonicResidual(chain, values)) as number[]).every((value) => Math.abs(value) <= tolerance);
}

export function solveDirichletProblem<S extends string>(
  chain: MarkovChain<S>,
  boundaryValues: Partial<Record<S, number>>,
): Distribution<S> {
  const boundary = new Set(Object.keys(boundaryValues) as S[]);
  if (boundary.size === 0) {
    throw new Error("At least one boundary value is required");
  }
  for (const state of boundary) {
    valueFor(boundaryValues, state);
    if (!chain.states.includes(state)) {
      throw new Error(`Unknown boundary state: ${String(state)}`);
    }
  }

  const unknown = chain.states.filter((state) => !boundary.has(state));
  if (unknown.length === 0) {
    return { ...boundaryValues } as Distribution<S>;
  }

  const matrix = unknown.map((state) =>
    unknown.map((other) => (state === other ? 1 : 0) - chain.transitionProbability(state, other)),
  );
  const rhs = unknown.map((state) => {
    let total = 0;
    for (const boundaryState of boundary) {
      total += chain.transitionProbability(state, boundaryState) * valueFor(boundaryValues, boundaryState);
    }
    return total;
  });
  const solution = solveLinearSystem(matrix, rhs);
  const result: Partial<Record<S, number>> = { ...boundaryValues };
  for (let index = 0; index < unknown.length; index++) {
    result[unknown[index]!] = solution[index]!;
  }
  return result as Distribution<S>;
}

export function hittingProbability<S extends string>(
  chain: MarkovChain<S>,
  target: S | readonly S[],
  avoid: readonly S[] = [],
): Distribution<S> {
  const targets = new Set<S>(Array.isArray(target) ? [...target] : [target]);
  const avoids = new Set(avoid);
  for (const state of targets) {
    if (avoids.has(state)) {
      throw new Error(`State cannot be both target and avoided: ${String(state)}`);
    }
  }
  const boundary: Partial<Record<S, number>> = {};
  for (const state of targets) boundary[state] = 1;
  for (const state of avoids) boundary[state] = 0;
  return solveDirichletProblem(chain, boundary);
}

export function estimateOptionalStopping<S extends string>(
  chain: MarkovChain<S>,
  values: Partial<Record<S, number>>,
  start: S,
  options: {
    trials: number;
    maxSteps: number;
    stop: (state: S) => boolean;
    rng?: Rng;
  },
): { initial: number; stoppedMean: number; difference: number } {
  if (!Number.isInteger(options.trials) || options.trials <= 0) {
    throw new Error(`Trials must be a positive integer; received ${options.trials}`);
  }
  if (!Number.isInteger(options.maxSteps) || options.maxSteps < 0) {
    throw new Error(`maxSteps must be a nonnegative integer; received ${options.maxSteps}`);
  }

  let total = 0;
  for (let trial = 0; trial < options.trials; trial++) {
    let current = start;
    for (let step = 0; step < options.maxSteps && !options.stop(current); step++) {
      current = chain.simulate(current, 1, { rng: options.rng }).at(-1)!;
    }
    total += valueFor(values, current);
  }
  const initial = valueFor(values, start);
  const stoppedMean = total / options.trials;
  return { initial, stoppedMean, difference: stoppedMean - initial };
}

function valueFor<S extends string>(values: Partial<Record<S, number>>, state: S): number {
  const value = values[state];
  if (value === undefined) {
    throw new Error(`Missing value for state ${String(state)}`);
  }
  assertFiniteNumber(value, `Value for ${String(state)}`);
  return value;
}
