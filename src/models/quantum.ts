import { DEFAULT_TOLERANCE, type Matrix, assertFiniteNumber } from "./core.ts";

export interface Complex {
  re: number;
  im: number;
}

export type ComplexMatrix = Complex[][];
export type DensityMatrix = ComplexMatrix;

export class QuantumChannel {
  readonly kraus: ComplexMatrix[];

  constructor(kraus: readonly ComplexMatrix[]) {
    if (kraus.length === 0) {
      throw new Error("Quantum channel requires at least one Kraus operator");
    }
    this.kraus = kraus.map(cloneComplexMatrix);
    if (!isTracePreserving(this.kraus)) {
      throw new Error("Kraus operators must be trace preserving");
    }
  }

  apply(density: DensityMatrix): DensityMatrix {
    return applyChannel(density, this.kraus);
  }
}

export class QuantumMarkovChain {
  readonly channel: QuantumChannel;
  readonly initial: DensityMatrix;

  constructor(initial: DensityMatrix, channel: QuantumChannel) {
    if (!isDensityMatrix(initial)) {
      throw new Error("Initial quantum state must be a density matrix");
    }
    this.initial = cloneComplexMatrix(initial);
    this.channel = channel;
  }

  step(state: DensityMatrix = this.initial): DensityMatrix {
    return this.channel.apply(state);
  }

  simulate(steps: number): DensityMatrix[] {
    if (!Number.isInteger(steps) || steps < 0) {
      throw new Error(`Steps must be a nonnegative integer; received ${steps}`);
    }
    const path = [cloneComplexMatrix(this.initial)];
    let current = this.initial;
    for (let step = 0; step < steps; step++) {
      current = this.step(current);
      path.push(current);
    }
    return path;
  }
}

export function complex(re: number, im = 0): Complex {
  assertFiniteNumber(re, "Complex real part");
  assertFiniteNumber(im, "Complex imaginary part");
  return { re, im };
}

export function applyChannel(density: DensityMatrix, kraus: readonly ComplexMatrix[]): DensityMatrix {
  if (!isDensityMatrix(density)) {
    throw new Error("Input must be a density matrix");
  }
  let result = zeroMatrix(density.length);
  for (const operator of kraus) {
    result = addMatrix(result, multiplyMatrix(multiplyMatrix(operator, density), adjoint(operator)));
  }
  return result;
}

export function trace(matrix: ComplexMatrix): Complex {
  validateComplexSquare(matrix);
  let value = complex(0);
  for (let index = 0; index < matrix.length; index++) {
    value = add(value, matrix[index]![index]!);
  }
  return value;
}

export function isDensityMatrix(matrix: ComplexMatrix, tolerance = DEFAULT_TOLERANCE): boolean {
  try {
    validateComplexSquare(matrix);
  } catch {
    return false;
  }
  const tr = trace(matrix);
  if (Math.abs(tr.re - 1) > tolerance || Math.abs(tr.im) > tolerance) return false;
  for (let row = 0; row < matrix.length; row++) {
    for (let column = 0; column < matrix.length; column++) {
      const a = matrix[row]![column]!;
      const b = conjugate(matrix[column]![row]!);
      if (distance(a, b) > tolerance) return false;
    }
  }
  if (matrix.length === 2) {
    const determinant = sub(
      mul(matrix[0]![0]!, matrix[1]![1]!),
      mul(matrix[0]![1]!, matrix[1]![0]!),
    );
    if (determinant.re < -tolerance || Math.abs(determinant.im) > tolerance) return false;
  }
  return true;
}

export function isTracePreserving(kraus: readonly ComplexMatrix[], tolerance = DEFAULT_TOLERANCE): boolean {
  if (kraus.length === 0) return false;
  try {
    validateComplexSquare(kraus[0]!);
    let total = zeroMatrix(kraus[0]!.length);
    for (const operator of kraus) {
      total = addMatrix(total, multiplyMatrix(adjoint(operator), operator));
    }
    for (let row = 0; row < total.length; row++) {
      for (let column = 0; column < total.length; column++) {
        const expected = row === column ? complex(1) : complex(0);
        if (distance(total[row]![column]!, expected) > tolerance) return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

export function bitFlipChannel(probability: number): QuantumChannel {
  validateQuantumProbability(probability);
  return new QuantumChannel([
    scaleComplexMatrix(identityComplex(2), Math.sqrt(1 - probability)),
    scaleComplexMatrix([[complex(0), complex(1)], [complex(1), complex(0)]], Math.sqrt(probability)),
  ]);
}

export function phaseFlipChannel(probability: number): QuantumChannel {
  validateQuantumProbability(probability);
  return new QuantumChannel([
    scaleComplexMatrix(identityComplex(2), Math.sqrt(1 - probability)),
    scaleComplexMatrix([[complex(1), complex(0)], [complex(0), complex(-1)]], Math.sqrt(probability)),
  ]);
}

export function depolarizingChannel(probability: number): QuantumChannel {
  validateQuantumProbability(probability);
  const p = probability / 3;
  return new QuantumChannel([
    scaleComplexMatrix(identityComplex(2), Math.sqrt(1 - probability)),
    scaleComplexMatrix([[complex(0), complex(1)], [complex(1), complex(0)]], Math.sqrt(p)),
    scaleComplexMatrix([[complex(0), complex(0, -1)], [complex(0, 1), complex(0)]], Math.sqrt(p)),
    scaleComplexMatrix([[complex(1), complex(0)], [complex(0), complex(-1)]], Math.sqrt(p)),
  ]);
}

export function amplitudeDampingChannel(probability: number): QuantumChannel {
  validateQuantumProbability(probability);
  return new QuantumChannel([
    [[complex(1), complex(0)], [complex(0), complex(Math.sqrt(1 - probability))]],
    [[complex(0), complex(Math.sqrt(probability))], [complex(0), complex(0)]],
  ]);
}

function validateQuantumProbability(value: number) {
  assertFiniteNumber(value, "Quantum probability");
  if (value < 0 || value > 1) {
    throw new Error(`Quantum probability must be in [0, 1]; received ${value}`);
  }
}

function identityComplex(size: number): ComplexMatrix {
  const matrix: ComplexMatrix = [];
  for (let row = 0; row < size; row++) {
    matrix.push(Array.from({ length: size }, (_unused, column) => complex(row === column ? 1 : 0)));
  }
  return matrix;
}

function zeroMatrix(size: number): ComplexMatrix {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => complex(0)));
}

function cloneComplexMatrix(matrix: ComplexMatrix): ComplexMatrix {
  validateComplexSquare(matrix);
  return matrix.map((row) => row.map((value) => complex(value.re, value.im)));
}

function validateComplexSquare(matrix: ComplexMatrix) {
  if (matrix.length === 0) {
    throw new Error("Complex matrix must have at least one row");
  }
  for (const row of matrix) {
    if (row.length !== matrix.length) {
      throw new Error("Complex matrix must be square");
    }
    for (const value of row) {
      complex(value.re, value.im);
    }
  }
}

function add(a: Complex, b: Complex): Complex {
  return complex(a.re + b.re, a.im + b.im);
}

function sub(a: Complex, b: Complex): Complex {
  return complex(a.re - b.re, a.im - b.im);
}

function mul(a: Complex, b: Complex): Complex {
  return complex(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
}

function conjugate(value: Complex): Complex {
  return complex(value.re, -value.im);
}

function distance(a: Complex, b: Complex): number {
  return Math.hypot(a.re - b.re, a.im - b.im);
}

function addMatrix(a: ComplexMatrix, b: ComplexMatrix): ComplexMatrix {
  return a.map((row, i) => row.map((value, j) => add(value, b[i]![j]!)));
}

function multiplyMatrix(a: ComplexMatrix, b: ComplexMatrix): ComplexMatrix {
  validateComplexSquare(a);
  validateComplexSquare(b);
  const result = zeroMatrix(a.length);
  for (let row = 0; row < a.length; row++) {
    for (let column = 0; column < a.length; column++) {
      let value = complex(0);
      for (let inner = 0; inner < a.length; inner++) {
        value = add(value, mul(a[row]![inner]!, b[inner]![column]!));
      }
      result[row]![column] = value;
    }
  }
  return result;
}

function adjoint(matrix: ComplexMatrix): ComplexMatrix {
  validateComplexSquare(matrix);
  return matrix.map((_row, row) => matrix.map((_other, column) => conjugate(matrix[column]![row]!)));
}

function scaleComplexMatrix(matrix: ComplexMatrix, scalar: number): ComplexMatrix {
  assertFiniteNumber(scalar, "Complex matrix scale");
  return matrix.map((row) => row.map((value) => complex(value.re * scalar, value.im * scalar)));
}
