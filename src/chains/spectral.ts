import {
  DEFAULT_MAX_ITERATIONS,
  DEFAULT_TOLERANCE,
  type Matrix,
  assertSquareMatrix,
  matrixVectorMultiply,
  rowVectorMatrixMultiply,
  vectorDistance,
} from "../shared/core.ts";
import { MarkovChain } from "./markov-chain.ts";

export interface Eigenpair {
  value: number;
  vector: number[];
  iterations: number;
}

export function powerIteration(
  matrix: Matrix,
  options: { tolerance?: number; maxIterations?: number } = {},
): Eigenpair {
  assertSquareMatrix(matrix);
  const tolerance = options.tolerance ?? DEFAULT_TOLERANCE;
  const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  let vector = Array(matrix.length).fill(1 / Math.sqrt(matrix.length)) as number[];

  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    const multiplied = matrixVectorMultiply(matrix, vector);
    const norm = Math.sqrt(multiplied.reduce((total, value) => total + value * value, 0));
    if (norm <= tolerance) {
      throw new Error("Power iteration encountered a zero vector");
    }
    const next = multiplied.map((value) => value / norm);
    if (vectorDistance(vector, next) <= tolerance) {
      return { value: rayleighQuotient(matrix, next), vector: next, iterations: iteration };
    }
    vector = next;
  }

  throw new Error(`Power iteration did not converge in ${maxIterations} iterations`);
}

export function dominantEigenpair(
  matrix: Matrix,
  options: { tolerance?: number; maxIterations?: number } = {},
): Eigenpair {
  return powerIteration(matrix, options);
}

export function eigenvalues2x2(matrix: Matrix): [number, number] {
  assertSquareMatrix(matrix);
  if (matrix.length !== 2) {
    throw new Error("eigenvalues2x2 requires a 2x2 matrix");
  }
  const a = matrix[0]![0]!;
  const b = matrix[0]![1]!;
  const c = matrix[1]![0]!;
  const d = matrix[1]![1]!;
  const trace = a + d;
  const determinant = a * d - b * c;
  const discriminant = trace * trace - 4 * determinant;
  if (discriminant < -DEFAULT_TOLERANCE) {
    throw new Error("Complex eigenvalues are not supported by eigenvalues2x2");
  }
  const root = Math.sqrt(Math.max(0, discriminant));
  return [(trace + root) / 2, (trace - root) / 2];
}

export function spectralGap(matrix: Matrix): number {
  assertSquareMatrix(matrix);
  if (matrix.length === 1) {
    return 1;
  }
  if (matrix.length === 2) {
    const values = eigenvalues2x2(matrix).map(Math.abs).sort((a, b) => b - a);
    return 1 - values[1]!;
  }
  let vector = Array(matrix.length).fill(0) as number[];
  vector[0] = 1;
  vector[1] = -1;
  let previousNorm = Math.sqrt(vector.reduce((total, value) => total + value * value, 0));
  for (let iteration = 0; iteration < 100; iteration++) {
    vector = rowVectorMatrixMultiply(vector, matrix);
    const mean = vector.reduce((total, value) => total + value, 0) / vector.length;
    vector = vector.map((value) => value - mean);
    const norm = Math.sqrt(vector.reduce((total, value) => total + value * value, 0));
    if (norm <= DEFAULT_TOLERANCE) {
      return 1;
    }
    previousNorm = norm; }
  return 1 - Math.min(1, previousNorm);
}

export function relaxationTime(matrix: Matrix): number {
  const gap = spectralGap(matrix);
  if (gap <= DEFAULT_TOLERANCE) {
    throw new Error("Relaxation time is infinite when spectral gap is zero");
  }
  return 1 / gap;
}

export function mixingDistance(a: readonly number[], b: readonly number[]): number {
  return vectorDistance(a, b) / 2;
}

export function estimateMixingTime<S extends string>(
  chain: MarkovChain<S>,
  initial: Partial<Record<S, number>>,
  options: { tolerance?: number; maxIterations?: number } = {},
): number {
  const tolerance = options.tolerance ?? 1e-6;
  const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const stationary = chain.stationary();
  const target = chain.toVector(stationary);
  for (let step = 0; step <= maxIterations; step++) {
    const current = chain.toVector(chain.distributionAfter(initial, step, { normalize: true }));
    if (mixingDistance(current, target) <= tolerance) {
      return step;
    }
  }
  throw new Error(`Mixing time was not reached in ${maxIterations} iterations`);
}

export function detailedBalanceResiduals<S extends string>(
  chain: MarkovChain<S>,
  stationary: Partial<Record<S, number>> = chain.stationary(),
): Array<{ from: S; to: S; residual: number }> {
  const pi = chain.toVector(stationary, { normalize: true });
  const residuals: Array<{ from: S; to: S; residual: number }> = [];
  for (let i = 0; i < chain.states.length; i++) {
    for (let j = i + 1; j < chain.states.length; j++) {
      residuals.push({
        from: chain.states[i]!,
        to: chain.states[j]!,
        residual: pi[i]! * chain.matrix[i]![j]! - pi[j]! * chain.matrix[j]![i]!,
      });
    }
  }
  return residuals;
}

export function isReversible<S extends string>(
  chain: MarkovChain<S>,
  stationary: Partial<Record<S, number>> = chain.stationary(),
  tolerance = DEFAULT_TOLERANCE,
): boolean {
  return detailedBalanceResiduals(chain, stationary).every((entry) => Math.abs(entry.residual) <= tolerance);
}

function rayleighQuotient(matrix: Matrix, vector: readonly number[]): number {
  const multiplied = matrixVectorMultiply(matrix, vector);
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < vector.length; i++) {
    numerator += vector[i]! * multiplied[i]!;
    denominator += vector[i]! * vector[i]!;
  }
  return numerator / denominator;
}
