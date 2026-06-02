export type Matrix = number[][];
export type Distribution<S extends string = string> = Record<S, number>;
export type WeightedTransitions<S extends string = string> = Record<S, Partial<Record<S, number>>>;

export interface Rng {
  next(): number;
  normal(mean?: number, standardDeviation?: number): number;
  exponential(rate: number): number;
}

export const DEFAULT_TOLERANCE = 1e-10;
export const DEFAULT_MAX_ITERATIONS = 10_000;

export class SeededRng implements Rng {
  private state: number;
  private spareNormal: number | undefined;

  constructor(seed = 1) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }

  normal(mean = 0, standardDeviation = 1): number {
    if (this.spareNormal !== undefined) {
      const value = this.spareNormal;
      this.spareNormal = undefined;
      return mean + standardDeviation * value;
    }

    let u = 0;
    let v = 0;
    while (u === 0) u = this.next();
    while (v === 0) v = this.next();

    const magnitude = Math.sqrt(-2 * Math.log(u));
    const z0 = magnitude * Math.cos(2 * Math.PI * v);
    const z1 = magnitude * Math.sin(2 * Math.PI * v);
    this.spareNormal = z1;
    return mean + standardDeviation * z0;
  }

  exponential(rate: number): number {
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error(`Exponential rate must be positive; received ${rate}`);
    }

    let u = 0;
    while (u === 0) u = this.next();
    return -Math.log(u) / rate;
  }
}

export class MathRandomRng implements Rng {
  constructor() {}

  next(): number {
    return Math.random();
  }

  normal(mean = 0, standardDeviation = 1): number {
    let u = 0;
    let v = 0;
    while (u === 0) u = this.next();
    while (v === 0) v = this.next();
    return mean + standardDeviation * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  exponential(rate: number): number {
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error(`Exponential rate must be positive; received ${rate}`);
    }

    let u = 0;
    while (u === 0) u = this.next();
    return -Math.log(u) / rate;
  }
}

export function rngOrDefault(rng?: Rng): Rng {
  return rng ?? new MathRandomRng();
}

export function assertProbability(value: number, label = "probability") {
  if (!Number.isFinite(value) || value < -DEFAULT_TOLERANCE || value > 1 + DEFAULT_TOLERANCE) {
    throw new Error(`${label} must be a probability in [0, 1]; received ${value}`);
  }
}

export function assertFiniteNumber(value: number, label: string) {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be finite; received ${value}`);
  }
}

export function normalizeDistribution<S extends string>(
  distribution: Partial<Record<S, number>>,
): Record<S, number> {
  const result: Partial<Record<S, number>> = {};
  let total = 0;

  for (const [key, value] of Object.entries(distribution) as [S, number | undefined][]) {
    const probability = value ?? 0;
    assertFiniteNumber(probability, `Distribution value for ${String(key)}`);
    if (probability < 0) {
      throw new Error(`Distribution value for ${String(key)} must be nonnegative`);
    }
    total += probability;
  }

  if (total <= 0) {
    throw new Error("Distribution total must be positive");
  }

  for (const [key, value] of Object.entries(distribution) as [S, number | undefined][]) {
    result[key] = (value ?? 0) / total;
  }

  return result as Record<S, number>;
}

export function distributionToVector<S extends string>(
  states: readonly S[],
  distribution: Partial<Record<S, number>>,
  options: { normalize?: boolean } = {},
): number[] {
  const vector: number[] = [];
  for (const state of states) {
    vector.push(distribution[state] ?? 0);
  }
  for (let i = 0; i < vector.length; i++) {
    const value = vector[i]!;
    assertFiniteNumber(value, `Distribution value for ${String(states[i])}`);
    if (value < 0) {
      throw new Error(`Distribution value for ${String(states[i])} must be nonnegative`);
    }
  }

  const total = vector.reduce((acc, value) => acc + value, 0);
  if (total <= 0) {
    throw new Error("Distribution total must be positive");
  }
  if (options.normalize) {
    const normalized: number[] = [];
    for (const value of vector) {
      normalized.push(value / total);
    }
    return normalized;
  }
  if (Math.abs(total - 1) > DEFAULT_TOLERANCE) {
    throw new Error(`Distribution must sum to 1; received ${total}`);
  }
  return vector;
}

export function vectorToDistribution<S extends string>(
  states: readonly S[],
  vector: readonly number[],
): Record<S, number> {
  if (states.length !== vector.length) {
    throw new Error("State and vector lengths must match");
  }

  const result: Partial<Record<S, number>> = {};
  for (let i = 0; i < states.length; i++) {
    result[states[i]!] = vector[i]!;
  }
  return result as Record<S, number>;
}

export function assertRectangularMatrix(matrix: Matrix, label = "Matrix") {
  if (matrix.length === 0) {
    throw new Error(`${label} must have at least one row`);
  }
  const width = matrix[0]?.length ?? 0;
  if (width === 0) {
    throw new Error(`${label} must have at least one column`);
  }
  for (let i = 0; i < matrix.length; i++) {
    if (matrix[i]!.length !== width) {
      throw new Error(`${label} must be rectangular`);
    }
    for (let j = 0; j < width; j++) {
      assertFiniteNumber(matrix[i]![j]!, `${label}[${i}][${j}]`);
    }
  }
}

export function assertSquareMatrix(matrix: Matrix, label = "Matrix") {
  assertRectangularMatrix(matrix, label);
  if (matrix.length !== matrix[0]!.length) {
    throw new Error(`${label} must be square`);
  }
}

export function cloneMatrix(matrix: Matrix): Matrix {
  const result: Matrix = [];
  for (const row of matrix) {
    result.push([...row]);
  }
  return result;
}

export function identity(size: number): Matrix {
  if (!Number.isInteger(size) || size < 0) {
    throw new Error(`Identity size must be a nonnegative integer; received ${size}`);
  }
  const result: Matrix = [];
  for (let i = 0; i < size; i++) {
    const row: number[] = [];
    for (let j = 0; j < size; j++) {
      row.push(i === j ? 1 : 0);
    }
    result.push(row);
  }
  return result;
}

export function transpose(matrix: Matrix): Matrix {
  assertRectangularMatrix(matrix);
  const rows = matrix.length;
  const columns = matrix[0]!.length;
  const result: Matrix = [];
  for (let j = 0; j < columns; j++) {
    const row: number[] = [];
    for (let i = 0; i < rows; i++) {
      row.push(matrix[i]![j]!);
    }
    result.push(row);
  }
  return result;
}

export function matrixMultiply(a: Matrix, b: Matrix): Matrix {
  assertRectangularMatrix(a, "Left matrix");
  assertRectangularMatrix(b, "Right matrix");
  const aColumns = a[0]!.length;
  const bRows = b.length;
  if (aColumns !== bRows) {
    throw new Error(`Matrix dimensions do not align: ${a.length}x${aColumns} times ${bRows}x${b[0]!.length}`);
  }

  const bColumns = b[0]!.length;
  const result: Matrix = [];
  for (let i = 0; i < a.length; i++) {
    const row: number[] = [];
    for (let j = 0; j < bColumns; j++) {
      let value = 0;
      for (let k = 0; k < aColumns; k++) {
        value += a[i]![k]! * b[k]![j]!;
      }
      row.push(value);
    }
    result.push(row);
  }
  return result;
}

export function matrixVectorMultiply(matrix: Matrix, vector: readonly number[]): number[] {
  assertRectangularMatrix(matrix);
  if (matrix[0]!.length !== vector.length) {
    throw new Error("Matrix and vector dimensions do not align");
  }
  const result: number[] = [];
  for (const row of matrix) {
    let total = 0;
    for (let index = 0; index < row.length; index++) {
      total += row[index]! * vector[index]!;
    }
    result.push(total);
  }
  return result;
}

export function rowVectorMatrixMultiply(vector: readonly number[], matrix: Matrix): number[] {
  assertRectangularMatrix(matrix);
  if (vector.length !== matrix.length) {
    throw new Error("Vector and matrix dimensions do not align");
  }

  const result = Array(matrix[0]!.length).fill(0) as number[];
  for (let i = 0; i < vector.length; i++) {
    for (let j = 0; j < matrix[0]!.length; j++) {
      result[j]! += vector[i]! * matrix[i]![j]!;
    }
  }
  return result;
}

export function matrixPower(matrix: Matrix, exponent: number): Matrix {
  assertSquareMatrix(matrix);
  if (!Number.isInteger(exponent) || exponent < 0) {
    throw new Error(`Matrix exponent must be a nonnegative integer; received ${exponent}`);
  }

  let result = identity(matrix.length);
  let base = cloneMatrix(matrix);
  let n = exponent;
  while (n > 0) {
    if (n % 2 === 1) {
      result = matrixMultiply(result, base);
    }
    n = Math.floor(n / 2);
    if (n > 0) {
      base = matrixMultiply(base, base);
    }
  }
  return result;
}

export function subtractMatrices(a: Matrix, b: Matrix): Matrix {
  assertRectangularMatrix(a, "Left matrix");
  assertRectangularMatrix(b, "Right matrix");
  if (a.length !== b.length || a[0]!.length !== b[0]!.length) {
    throw new Error("Matrix dimensions must match");
  }
  const result: Matrix = [];
  for (let i = 0; i < a.length; i++) {
    const row: number[] = [];
    for (let j = 0; j < a[0]!.length; j++) {
      row.push(a[i]![j]! - b[i]![j]!);
    }
    result.push(row);
  }
  return result;
}

export function scaleMatrix(matrix: Matrix, scalar: number): Matrix {
  assertFiniteNumber(scalar, "Scalar");
  assertRectangularMatrix(matrix);
  const result: Matrix = [];
  for (const sourceRow of matrix) {
    const row: number[] = [];
    for (const value of sourceRow) {
      row.push(value * scalar);
    }
    result.push(row);
  }
  return result;
}

export function addMatrices(a: Matrix, b: Matrix): Matrix {
  assertRectangularMatrix(a, "Left matrix");
  assertRectangularMatrix(b, "Right matrix");
  if (a.length !== b.length || a[0]!.length !== b[0]!.length) {
    throw new Error("Matrix dimensions must match");
  }
  const result: Matrix = [];
  for (let i = 0; i < a.length; i++) {
    const row: number[] = [];
    for (let j = 0; j < a[0]!.length; j++) {
      row.push(a[i]![j]! + b[i]![j]!);
    }
    result.push(row);
  }
  return result;
}

export function solveLinearSystem(matrix: Matrix, rhs: readonly number[], tolerance = DEFAULT_TOLERANCE): number[] {
  assertSquareMatrix(matrix);
  if (rhs.length !== matrix.length) {
    throw new Error("Right-hand side length must match matrix size");
  }

  const n = matrix.length;
  const augmented: Matrix = [];
  for (let i = 0; i < matrix.length; i++) {
    augmented.push([...matrix[i]!, rhs[i]!]);
  }

  for (let column = 0; column < n; column++) {
    let pivot = column;
    for (let row = column + 1; row < n; row++) {
      if (Math.abs(augmented[row]![column]!) > Math.abs(augmented[pivot]![column]!)) {
        pivot = row;
      }
    }

    if (Math.abs(augmented[pivot]![column]!) <= tolerance) {
      throw new Error("Linear system is singular or ill-conditioned");
    }

    if (pivot !== column) {
      const temp = augmented[column]!;
      augmented[column] = augmented[pivot]!;
      augmented[pivot] = temp;
    }

    const pivotValue = augmented[column]![column]!;
    for (let j = column; j <= n; j++) {
      augmented[column]![j] = augmented[column]![j]! / pivotValue;
    }

    for (let row = 0; row < n; row++) {
      if (row === column) continue;
      const factor = augmented[row]![column]!;
      for (let j = column; j <= n; j++) {
        augmented[row]![j] = augmented[row]![j]! - factor * augmented[column]![j]!;
      }
    }
  }

  const solution: number[] = [];
  for (const row of augmented) {
    solution.push(row[n]!);
  }
  return solution;
}

export function inverse(matrix: Matrix, tolerance = DEFAULT_TOLERANCE): Matrix {
  assertSquareMatrix(matrix);
  const n = matrix.length;
  const id = identity(n);
  const augmented: Matrix = [];
  for (let i = 0; i < matrix.length; i++) {
    augmented.push([...matrix[i]!, ...id[i]!]);
  }

  for (let column = 0; column < n; column++) {
    let pivot = column;
    for (let row = column + 1; row < n; row++) {
      if (Math.abs(augmented[row]![column]!) > Math.abs(augmented[pivot]![column]!)) {
        pivot = row;
      }
    }

    if (Math.abs(augmented[pivot]![column]!) <= tolerance) {
      throw new Error("Matrix is singular or ill-conditioned");
    }

    if (pivot !== column) {
      const temp = augmented[column]!;
      augmented[column] = augmented[pivot]!;
      augmented[pivot] = temp;
    }

    const pivotValue = augmented[column]![column]!;
    for (let j = 0; j < 2 * n; j++) {
      augmented[column]![j] = augmented[column]![j]! / pivotValue;
    }

    for (let row = 0; row < n; row++) {
      if (row === column) continue;
      const factor = augmented[row]![column]!;
      for (let j = 0; j < 2 * n; j++) {
        augmented[row]![j] = augmented[row]![j]! - factor * augmented[column]![j]!;
      }
    }
  }

  const result: Matrix = [];
  for (const row of augmented) {
    result.push(row.slice(n));
  }
  return result;
}

export function vectorDistance(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vector lengths must match");
  }
  let total = 0;
  for (let i = 0; i < a.length; i++) {
    total += Math.abs(a[i]! - b[i]!);
  }
  return total;
}

export function sampleIndex(weights: readonly number[], rng: Rng = new MathRandomRng()): number {
  if (weights.length === 0) {
    throw new Error("Cannot sample from an empty distribution");
  }

  let total = 0;
  for (const weight of weights) {
    assertFiniteNumber(weight, "Sample weight");
    if (weight < 0) {
      throw new Error("Sample weights must be nonnegative");
    }
    total += weight;
  }
  if (total <= 0) {
    throw new Error("At least one sample weight must be positive");
  }

  const r = rng.next() * total;
  let cumulative = 0;
  for (let i = 0; i < weights.length; i++) {
    cumulative += weights[i]!;
    if (r < cumulative) {
      return i;
    }
  }
  return weights.length - 1;
}

export function assertStochasticMatrix(matrix: Matrix, tolerance = DEFAULT_TOLERANCE) {
  assertSquareMatrix(matrix, "Transition matrix");
  for (let i = 0; i < matrix.length; i++) {
    let rowSum = 0;
    for (let j = 0; j < matrix.length; j++) {
      const value = matrix[i]![j]!;
      assertProbability(value, `Transition probability at [${i}][${j}]`);
      rowSum += value;
    }
    if (Math.abs(rowSum - 1) > tolerance) {
      throw new Error(`Transition matrix row ${i} must sum to 1; received ${rowSum}`);
    }
  }
}

export function assertGeneratorMatrix(matrix: Matrix, tolerance = DEFAULT_TOLERANCE) {
  assertSquareMatrix(matrix, "Generator matrix");
  for (let i = 0; i < matrix.length; i++) {
    let rowSum = 0;
    for (let j = 0; j < matrix.length; j++) {
      const value = matrix[i]![j]!;
      rowSum += value;
      if (i === j && value > tolerance) {
        throw new Error(`Generator diagonal at [${i}][${j}] must be nonpositive`);
      }
      if (i !== j && value < -tolerance) {
        throw new Error(`Generator off-diagonal at [${i}][${j}] must be nonnegative`);
      }
    }
    if (Math.abs(rowSum) > tolerance) {
      throw new Error(`Generator matrix row ${i} must sum to 0; received ${rowSum}`);
    }
  }
}

export function ensureKnown<S extends string>(states: readonly S[], state: S, label = "state") {
  if (!states.includes(state)) {
    throw new Error(`Unknown ${label}: ${String(state)}`);
  }
}

export function uniqueValues<S extends string>(values: readonly S[], label: string): S[] {
  const seen = new Set<S>();
  for (const value of values) {
    if (seen.has(value)) {
      throw new Error(`Duplicate ${label}: ${String(value)}`);
    }
    seen.add(value);
  }
  return [...seen];
}
