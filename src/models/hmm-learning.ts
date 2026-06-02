import { type Distribution, assertFiniteNumber, normalizeDistribution } from "../shared/core.ts";
import { HiddenMarkovModel, type HMMConfig } from "./hmm.ts";

export interface HMMTrainingResult<S extends string, O extends string> {
  model: HiddenMarkovModel<S, O>;
  iterations: number;
  logLikelihoods: number[];
  converged: boolean;
}

export interface SupervisedHMMSequence<S extends string, O extends string> {
  states: readonly S[];
  observations: readonly O[];
}

export function supervisedHMMFit<S extends string, O extends string>(config: {
  states: readonly S[];
  observations: readonly O[];
  sequences: readonly SupervisedHMMSequence<S, O>[];
  smoothing?: number;
}): HiddenMarkovModel<S, O> {
  const smoothing = validateSmoothing(config.smoothing ?? 0);
  if (config.sequences.length === 0) {
    throw new Error("At least one supervised sequence is required");
  }

  const initial = filled(config.states, smoothing);
  const transition = nestedFilled(config.states, config.states, smoothing);
  const emission = nestedFilled(config.states, config.observations, smoothing);

  for (const sequence of config.sequences) {
    if (sequence.states.length !== sequence.observations.length || sequence.states.length === 0) {
      throw new Error("Supervised state and observation sequences must have matching nonzero length");
    }
    initial[sequence.states[0]!]! += 1;
    for (let index = 0; index < sequence.states.length; index++) {
      const state = sequence.states[index]!;
      const observation = sequence.observations[index]!;
      emission[state]![observation]! += 1;
      if (index < sequence.states.length - 1) {
        transition[state]![sequence.states[index + 1]!]! += 1;
      }
    }
  }

  return HiddenMarkovModel.from({
    states: config.states,
    observations: config.observations,
    initial: normalizeDistribution(initial),
    transition: normalizeNested(transition),
    emission: normalizeNested(emission),
  });
}

export function baumWelch<S extends string, O extends string>(config: {
  states: readonly S[];
  observations: readonly O[];
  sequences: readonly (readonly O[])[];
  initialModel?: HMMConfig<S, O>;
  smoothing?: number;
  tolerance?: number;
  maxIterations?: number;
}): HMMTrainingResult<S, O> {
  const smoothing = validateSmoothing(config.smoothing ?? 1e-6);
  const tolerance = config.tolerance ?? 1e-6;
  const maxIterations = config.maxIterations ?? 50;
  if (!Number.isInteger(maxIterations) || maxIterations <= 0) {
    throw new Error(`maxIterations must be a positive integer; received ${maxIterations}`);
  }
  if (config.sequences.length === 0 || config.sequences.some((sequence) => sequence.length === 0)) {
    throw new Error("Baum-Welch requires nonempty observation sequences");
  }

  let model = config.initialModel
    ? HiddenMarkovModel.from(config.initialModel)
    : uniformHMM(config.states, config.observations);
  const logLikelihoods: number[] = [];
  let converged = false;

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const initialCounts = filled(config.states, smoothing);
    const transitionCounts = nestedFilled(config.states, config.states, smoothing);
    const emissionCounts = nestedFilled(config.states, config.observations, smoothing);
    let logLikelihood = 0;

    for (const sequence of config.sequences) {
      const fb = forwardBackward(model, sequence);
      logLikelihood += fb.logLikelihood;
      for (let state = 0; state < model.states.length; state++) {
        initialCounts[model.states[state]!]! += fb.gamma[0]![state]!;
      }
      for (let time = 0; time < sequence.length; time++) {
        const observation = sequence[time]!;
        for (let state = 0; state < model.states.length; state++) {
          emissionCounts[model.states[state]!]![observation]! += fb.gamma[time]![state]!;
        }
      }
      for (let time = 0; time < sequence.length - 1; time++) {
        for (let from = 0; from < model.states.length; from++) {
          for (let to = 0; to < model.states.length; to++) {
            transitionCounts[model.states[from]!]![model.states[to]!]! += fb.xi[time]![from]![to]!;
          }
        }
      }
    }

    logLikelihoods.push(logLikelihood);
    model = HiddenMarkovModel.from({
      states: config.states,
      observations: config.observations,
      initial: normalizeDistribution(initialCounts),
      transition: normalizeNested(transitionCounts),
      emission: normalizeNested(emissionCounts),
    });

    if (logLikelihoods.length > 1) {
      const previous = logLikelihoods[logLikelihoods.length - 2]!;
      if (Math.abs(logLikelihood - previous) <= tolerance) {
        converged = true;
        return { model, iterations: iteration + 1, logLikelihoods, converged };
      }
    }
  }

  return { model, iterations: maxIterations, logLikelihoods, converged };
}

function forwardBackward<S extends string, O extends string>(
  model: HiddenMarkovModel<S, O>,
  sequence: readonly O[],
): { gamma: number[][]; xi: number[][][]; logLikelihood: number } {
  const forward = model.forward(sequence);
  const beta = Array.from({ length: sequence.length }, () =>
    Array(model.states.length).fill(1) as number[],
  );
  for (let time = sequence.length - 2; time >= 0; time--) {
    const observationIndex = model.observations.indexOf(sequence[time + 1]!);
    for (let from = 0; from < model.states.length; from++) {
      let total = 0;
      for (let to = 0; to < model.states.length; to++) {
        total += model.transition[from]![to]! * model.emission[to]![observationIndex]! * beta[time + 1]![to]!;
      }
      beta[time]![from] = total / forward.scales[time + 1]!;
    }
  }

  const gamma = forward.alpha.map((row, time) => normalizeVector(row.map((value, state) => value * beta[time]![state]!)));
  const xi: number[][][] = [];
  for (let time = 0; time < sequence.length - 1; time++) {
    const observationIndex = model.observations.indexOf(sequence[time + 1]!);
    const rows: number[][] = [];
    let total = 0;
    for (let from = 0; from < model.states.length; from++) {
      rows[from] = [];
      for (let to = 0; to < model.states.length; to++) {
        const value = forward.alpha[time]![from]! * model.transition[from]![to]! *
          model.emission[to]![observationIndex]! * beta[time + 1]![to]!;
        rows[from]![to] = value;
        total += value;
      }
    }
    xi.push(rows.map((row) => row.map((value) => value / total)));
  }
  return { gamma, xi, logLikelihood: forward.logProbability };
}

function uniformHMM<S extends string, O extends string>(
  states: readonly S[],
  observations: readonly O[],
): HiddenMarkovModel<S, O> {
  return HiddenMarkovModel.from({
    states,
    observations,
    initial: Object.fromEntries(states.map((state) => [state, 1 / states.length])) as Distribution<S>,
    transition: Object.fromEntries(
      states.map((state) => [state, Object.fromEntries(states.map((next) => [next, 1 / states.length]))]),
    ) as Record<S, Distribution<S>>,
    emission: Object.fromEntries(
      states.map((state) => [state, Object.fromEntries(observations.map((observation) => [observation, 1 / observations.length]))]),
    ) as Record<S, Distribution<O>>,
  });
}

function filled<K extends string>(keys: readonly K[], value: number): Record<K, number> {
  return Object.fromEntries(keys.map((key) => [key, value])) as Record<K, number>;
}

function nestedFilled<A extends string, B extends string>(
  rows: readonly A[],
  columns: readonly B[],
  value: number,
): Record<A, Record<B, number>> {
  return Object.fromEntries(rows.map((row) => [row, filled(columns, value)])) as Record<A, Record<B, number>>;
}

function normalizeNested<A extends string, B extends string>(
  table: Record<A, Record<B, number>>,
): Record<A, Distribution<B>> {
  return Object.fromEntries(
    Object.entries(table).map(([key, row]) => [key, normalizeDistribution(row as Record<B, number>)]),
  ) as Record<A, Distribution<B>>;
}

function normalizeVector(values: readonly number[]): number[] {
  const total = values.reduce((sum, value) => sum + value, 0);
  return values.map((value) => value / total);
}

function validateSmoothing(value: number): number {
  assertFiniteNumber(value, "Smoothing");
  if (value < 0) {
    throw new Error(`Smoothing must be nonnegative; received ${value}`);
  }
  return value;
}
