import {
  type Rng,
  assertFiniteNumber,
  normalizeDistribution,
  rngOrDefault,
  sampleIndex,
} from "../shared/core.ts";

export type BranchingClassification = "subcritical" | "critical" | "supercritical";

export class GaltonWatsonProcess {
  readonly offspring: Record<number, number>;
  private readonly counts: number[];
  private readonly weights: number[];

  constructor(offspring: Record<number, number>) {
    const normalized = normalizeDistribution(offspring as Record<string, number>);
    this.offspring = {} as Record<number, number>;
    this.counts = [];
    this.weights = [];
    for (const [key, probability] of Object.entries(normalized)) {
      const count = Number(key);
      if (!Number.isInteger(count) || count < 0) {
        throw new Error(`Offspring count must be a nonnegative integer; received ${key}`);
      }
      this.offspring[count] = probability;
      this.counts.push(count);
      this.weights.push(probability);
    }
  }

  meanOffspring(): number {
    return this.counts.reduce((total, count, index) => total + count * this.weights[index]!, 0);
  }

  classification(tolerance = 1e-10): BranchingClassification {
    const mean = this.meanOffspring();
    if (mean < 1 - tolerance) return "subcritical";
    if (mean > 1 + tolerance) return "supercritical";
    return "critical";
  }

  extinctionProbability(options: { tolerance?: number; maxIterations?: number } = {}): number {
    if (this.meanOffspring() <= 1) {
      return 1;
    }
    const tolerance = options.tolerance ?? 1e-10;
    const maxIterations = options.maxIterations ?? 10_000;
    let q = 0;
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      const next = this.generatingFunction(q);
      if (Math.abs(next - q) <= tolerance) return next;
      q = next;
    }
    throw new Error(`Extinction probability did not converge in ${maxIterations} iterations`);
  }

  simulateGenerations(
    initialPopulation: number,
    generations: number,
    options: { rng?: Rng } = {},
  ): number[] {
    if (!Number.isInteger(initialPopulation) || initialPopulation < 0) {
      throw new Error(`Initial population must be a nonnegative integer; received ${initialPopulation}`);
    }
    if (!Number.isInteger(generations) || generations < 0) {
      throw new Error(`Generations must be a nonnegative integer; received ${generations}`);
    }
    const rng = rngOrDefault(options.rng);
    const path = [initialPopulation];
    let population = initialPopulation;
    for (let generation = 0; generation < generations; generation++) {
      let next = 0;
      for (let individual = 0; individual < population; individual++) {
        next += this.sampleOffspring(rng);
      }
      population = next;
      path.push(population);
    }
    return path;
  }

  generationDistribution(
    initialPopulation: number,
    generations: number,
    trials: number,
    options: { rng?: Rng } = {},
  ): Record<number, number> {
    if (!Number.isInteger(trials) || trials <= 0) {
      throw new Error(`Trials must be a positive integer; received ${trials}`);
    }
    const counts: Record<number, number> = {};
    for (let trial = 0; trial < trials; trial++) {
      const terminal = this.simulateGenerations(initialPopulation, generations, options).at(-1)!;
      counts[terminal] = (counts[terminal] ?? 0) + 1;
    }
    return normalizeDistribution(counts as Record<string, number>) as unknown as Record<number, number>;
  }

  private sampleOffspring(rng: Rng): number {
    return this.counts[sampleIndex(this.weights, rng)]!;
  }

  private generatingFunction(value: number): number {
    assertFiniteNumber(value, "Generating function input");
    return this.counts.reduce((total, count, index) => total + this.weights[index]! * value ** count, 0);
  }
}
