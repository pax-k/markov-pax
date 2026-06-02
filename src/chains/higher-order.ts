import {
  type Distribution,
  type Rng,
  normalizeDistribution,
  rngOrDefault,
  sampleIndex,
  uniqueValues,
} from "../shared/core.ts";
import { MarkovChain } from "./markov-chain.ts";

export interface HigherOrderFitOptions {
  order: number;
  smoothing?: number;
}

export class HigherOrderMarkovModel<S extends string> {
  readonly order: number;
  readonly states: S[];
  readonly transitions: Record<string, Distribution<S>>;

  constructor(
    order: number,
    states: readonly S[],
    transitions: Record<string, Partial<Record<S, number>>>,
  ) {
    if (!Number.isInteger(order) || order <= 0) {
      throw new Error(`Order must be a positive integer; received ${order}`);
    }
    this.order = order;
    this.states = uniqueValues(states, "state");
    this.transitions = {};
    for (const [key, row] of Object.entries(transitions)) {
      this.transitions[key] = normalizeDistribution(row);
    }
  }

  static fit<S extends string>(
    sequences: readonly (readonly S[])[],
    options: HigherOrderFitOptions,
  ): HigherOrderMarkovModel<S> {
    if (!Number.isInteger(options.order) || options.order <= 0) {
      throw new Error(`Order must be a positive integer; received ${options.order}`);
    }
    const smoothing = options.smoothing ?? 0;
    if (!Number.isFinite(smoothing) || smoothing < 0) {
      throw new Error(`Smoothing must be nonnegative; received ${smoothing}`);
    }

    const states = uniqueValues([...new Set(sequences.flat())], "state");
    const counts: Record<string, Partial<Record<S, number>>> = {};
    for (const sequence of sequences) {
      for (let index = options.order; index < sequence.length; index++) {
        const context = sequence.slice(index - options.order, index);
        const key = contextKey(context);
        counts[key] ??= {};
        const next = sequence[index]!;
        counts[key]![next] = (counts[key]![next] ?? 0) + 1;
      }
    }
    if (Object.keys(counts).length === 0) {
      throw new Error("At least one sequence must contain a context and next state");
    }

    if (smoothing > 0) {
      for (const row of Object.values(counts)) {
        for (const state of states) {
          row[state] = (row[state] ?? 0) + smoothing;
        }
      }
    }

    return new HigherOrderMarkovModel(options.order, states, counts);
  }

  predictNext(context: readonly S[]): Distribution<S> {
    const key = this.keyFromContext(context);
    const row = this.transitions[key];
    if (!row) {
      throw new Error(`Unknown context: ${key}`);
    }
    return { ...row };
  }

  simulate(context: readonly S[], steps: number, options: { rng?: Rng } = {}): S[] {
    if (!Number.isInteger(steps) || steps < 0) {
      throw new Error(`Steps must be a nonnegative integer; received ${steps}`);
    }
    const rng = rngOrDefault(options.rng);
    const path = [...context];
    for (let step = 0; step < steps; step++) {
      const row = this.predictNext(path.slice(-this.order));
      const weights = this.states.map((state) => row[state] ?? 0);
      path.push(this.states[sampleIndex(weights, rng)]!);
    }
    return path;
  }

  toFirstOrderChain(): MarkovChain<string> {
    const transitions: Record<string, Partial<Record<string, number>>> = {};
    const destinations = new Set<string>();
    for (const [key, row] of Object.entries(this.transitions)) {
      const context = JSON.parse(key) as S[];
      transitions[key] = {};
      for (const state of this.states) {
        const probability = row[state] ?? 0;
        if (probability > 0) {
          const destination = contextKey([...context.slice(1), state]);
          transitions[key]![destination] = probability;
          destinations.add(destination);
        }
      }
    }
    for (const destination of destinations) {
      transitions[destination] ??= { [destination]: 1 };
    }
    return MarkovChain.from(transitions);
  }

  private keyFromContext(context: readonly S[]): string {
    if (context.length < this.order) {
      throw new Error(`Context must contain at least ${this.order} states`);
    }
    return contextKey(context.slice(-this.order));
  }
}

function contextKey<S extends string>(context: readonly S[]): string {
  return JSON.stringify(context);
}
