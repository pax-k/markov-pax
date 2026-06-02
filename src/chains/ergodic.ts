import { type Rng, assertFiniteNumber } from "../shared/core.ts";
import { MarkovChain } from "./markov-chain.ts";

export function timeAverage<S>(path: readonly S[], observable: (state: S) => number): number {
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

export function runningMean(values: readonly number[]): number[] {
  if (values.length === 0) {
    throw new Error("Values must contain at least one number");
  }
  let total = 0;
  return values.map((value, index) => {
    assertFiniteNumber(value, "Running mean value");
    total += value;
    return total / (index + 1);
  });
}

export function stationaryExpectation<S extends string>(
  chain: MarkovChain<S>,
  observable: (state: S) => number,
): number {
  const stationary = chain.stationary();
  let total = 0;
  for (const state of chain.states) {
    const value = observable(state);
    assertFiniteNumber(value, "Observable value");
    total += stationary[state] * value;
  }
  return total;
}

export function autocorrelation(samples: readonly number[], lag: number): number {
  if (!Number.isInteger(lag) || lag < 0 || lag >= samples.length) {
    throw new Error(`Lag must be an integer between 0 and samples.length - 1; received ${lag}`);
  }
  const mean = runningMean(samples).at(-1)!;
  const variance = samples.reduce((total, value) => total + (value - mean) ** 2, 0) / samples.length;
  if (variance === 0) {
    return lag === 0 ? 1 : 0;
  }
  let covariance = 0;
  for (let index = 0; index < samples.length - lag; index++) {
    covariance += (samples[index]! - mean) * (samples[index + lag]! - mean);
  }
  return covariance / ((samples.length - lag) * variance);
}

export function effectiveSampleSize(samples: readonly number[], maxLag = Math.min(100, samples.length - 1)): number {
  if (samples.length < 2) {
    throw new Error("At least two samples are required");
  }
  let sum = 0;
  for (let lag = 1; lag <= maxLag; lag++) {
    const rho = autocorrelation(samples, lag);
    if (rho <= 0) break;
    sum += rho;
  }
  return samples.length / (1 + 2 * sum);
}

export function batchMeans(samples: readonly number[], batchSize: number): number[] {
  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new Error(`Batch size must be a positive integer; received ${batchSize}`);
  }
  if (batchSize > samples.length) {
    throw new Error("Batch size must not exceed sample count");
  }
  const means: number[] = [];
  for (let index = 0; index + batchSize <= samples.length; index += batchSize) {
    means.push(timeAverage(samples.slice(index, index + batchSize), (value) => value));
  }
  return means;
}

export function compareTimeAndStationaryAverage<S extends string>(
  chain: MarkovChain<S>,
  start: S,
  steps: number,
  observable: (state: S) => number,
  options: { rng?: Rng } = {},
): { timeAverage: number; stationaryExpectation: number; difference: number } {
  const path = chain.simulate(start, steps, options);
  const pathAverage = timeAverage(path, observable);
  const expected = stationaryExpectation(chain, observable);
  return { timeAverage: pathAverage, stationaryExpectation: expected, difference: pathAverage - expected };
}
