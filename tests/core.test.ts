import { describe, expect, test } from "bun:test";
import {
  MathRandomRng,
  SeededRng,
  addMatrices,
  assertFiniteNumber,
  assertProbability,
  assertRectangularMatrix,
  assertSquareMatrix,
  distributionToVector,
  identity,
  inverse,
  matrixMultiply,
  matrixPower,
  matrixVectorMultiply,
  normalizeDistribution,
  rngOrDefault,
  rowVectorMatrixMultiply,
  sampleIndex,
  scaleMatrix,
  solveLinearSystem,
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

describe("core math utilities", () => {
  test("multiplies, powers, inverts, solves, transposes, and normalizes", () => {
    expect(matrixMultiply(
      [
        [1, 2],
        [3, 4],
      ],
      [
        [2, 0],
        [1, 2],
      ],
    )).toEqual([
      [4, 4],
      [10, 8],
    ]);

    expect(matrixPower(
      [
        [0.5, 0.5],
        [0.25, 0.75],
      ],
      2,
    )).toEqual([
      [0.375, 0.625],
      [0.3125, 0.6875],
    ]);

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

    const inv = inverse([
      [4, 7],
      [2, 6],
    ]);
    expectClose(inv[0]![0]!, 0.6);
    expectClose(inv[0]![1]!, -0.7);
    expectClose(inv[1]![0]!, -0.2);
    expectClose(inv[1]![1]!, 0.4);

    const solution = solveLinearSystem(
      [
        [3, 2],
        [1, 2],
      ],
      [5, 5],
    );
    expectClose(solution[0]!, 0);
    expectClose(solution[1]!, 2.5);

    expect(identity(2)).toEqual([
      [1, 0],
      [0, 1],
    ]);

    expect(addMatrices([[1]], [[2]])).toEqual([[3]]);
    expect(subtractMatrices([[3]], [[2]])).toEqual([[1]]);
    expect(scaleMatrix([[2]], 3)).toEqual([[6]]);
    const rowVectorProduct = rowVectorMatrixMultiply([0.25, 0.75], [
      [0.2, 0.8],
      [0.6, 0.4],
    ]);
    expectClose(rowVectorProduct[0]!, 0.5);
    expectClose(rowVectorProduct[1]!, 0.5);

    const normalized = normalizeDistribution({ A: 2, B: 3 });
    expectClose(normalized.A, 0.4);
    expectClose(normalized.B, 0.6);
    expect(distributionToVector(["A", "B"], { A: 2, B: 1 }, { normalize: true })).toEqual([2 / 3, 1 / 3]);
    expect(vectorToDistribution(["A", "B"], [0.4, 0.6])).toEqual({ A: 0.4, B: 0.6 });
    expectClose(vectorDistance([0.4, 0.6], [0.1, 0.9]), 0.6);
  });

  test("covers seeded and Math.random-backed RNG behavior", () => {
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

    const provided = new MathRandomRng();
    expect(rngOrDefault(provided)).toBe(provided);
    expect(rngOrDefault().next()).toBeGreaterThanOrEqual(0);
  });

  test("samples weighted indices and rejects invalid sampling inputs", () => {
    expect(sampleIndex([0.2, 0.8], {
      next: () => 1,
      normal: () => 0,
      exponential: () => 0,
    })).toBe(1);

    expect(() => sampleIndex([])).toThrow(/empty/i);
    expect(() => sampleIndex([-1])).toThrow(/nonnegative/i);
    expect(() => sampleIndex([0, 0])).toThrow(/positive/i);
  });

  test("rejects invalid matrices, systems, vectors, and distributions", () => {
    expect(() => assertFiniteNumber(Number.NaN, "value")).toThrow(/finite/i);
    expect(() => assertProbability(Number.NaN)).toThrow(/probability/i);
    expect(() => assertRectangularMatrix([])).toThrow(/row/i);
    expect(() => assertRectangularMatrix([[]])).toThrow(/column/i);
    expect(() => assertRectangularMatrix([[1], [1, 2]])).toThrow(/rectangular/i);
    expect(() => assertRectangularMatrix([[Number.NaN]])).toThrow(/finite/i);
    expect(() => assertSquareMatrix([[1, 2]])).toThrow(/square/i);
    expect(() => identity(-1)).toThrow(/nonnegative/i);

    expect(() => inverse([
      [1, 2],
      [2, 4],
    ])).toThrow(/singular/i);
    expect(() => solveLinearSystem([
      [1, 2],
      [2, 4],
    ], [1, 2])).toThrow(/singular/i);
    expect(() => matrixMultiply([[1, 2]], [[1, 2]])).toThrow(/dimensions/i);
    expect(() => matrixPower([[1]], -1)).toThrow(/exponent/i);
    expect(() => matrixVectorMultiply([[1, 2]], [1])).toThrow(/dimensions/i);
    expect(() => rowVectorMatrixMultiply([1], [[1], [2]])).toThrow(/dimensions/i);
    expect(() => subtractMatrices([[1]], [[1, 2]])).toThrow(/dimensions/i);
    expect(() => scaleMatrix([[1]], Number.NaN)).toThrow(/finite/i);
    expect(() => addMatrices([[1]], [[1, 2]])).toThrow(/dimensions/i);
    expect(() => vectorDistance([1], [1, 2])).toThrow(/length/i);

    expect(() => normalizeDistribution({ A: 0, B: 0 })).toThrow(/positive/i);
    expect(() => normalizeDistribution({ A: -1, B: 2 })).toThrow(/nonnegative/i);
    expect(() => distributionToVector(["A"], { A: -1 })).toThrow(/nonnegative/i);
    expect(() => vectorToDistribution(["A"], [1, 0])).toThrow(/length/i);
  });
});
