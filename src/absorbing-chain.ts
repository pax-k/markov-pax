import {
  type Matrix,
  type WeightedTransitions,
  identity,
  inverse,
  matrixMultiply,
  subtractMatrices,
  vectorToDistribution,
} from "./core.ts";
import { MarkovChain, type MarkovChainOptions } from "./markov-chain.ts";

export class AbsorbingChain<S extends string> {
  readonly chain: MarkovChain<S>;

  constructor(chain: MarkovChain<S>) {
    this.chain = chain;
    if (this.absorbingStates().length === 0) {
      throw new Error("Absorbing chain must contain at least one absorbing state");
    }
  }

  static from<S extends string>(
    transitions: WeightedTransitions<S>,
    options: MarkovChainOptions = {},
  ): AbsorbingChain<S> {
    return new AbsorbingChain(MarkovChain.from(transitions, options));
  }

  absorbingStates(): S[] {
    return this.chain.states.filter((state) => this.chain.transitionProbability(state, state) === 1);
  }

  transientStates(): S[] {
    const absorbing = new Set(this.absorbingStates());
    return this.chain.states.filter((state) => !absorbing.has(state));
  }

  fundamentalMatrix(): Matrix {
    const { q } = this.canonicalBlocks();
    return inverse(subtractMatrices(identity(q.length), q));
  }

  absorptionProbabilities(): Record<S, Record<S, number>> {
    const { absorbing, transient, r } = this.canonicalBlocks();
    const n = this.fundamentalMatrix();
    const b = matrixMultiply(n, r);
    const result: Partial<Record<S, Record<S, number>>> = {};

    for (let i = 0; i < transient.length; i++) {
      result[transient[i]!] = vectorToDistribution(absorbing, b[i]!);
    }

    for (const state of absorbing) {
      const row: Partial<Record<S, number>> = {};
      for (const absorbingState of absorbing) {
        row[absorbingState] = state === absorbingState ? 1 : 0;
      }
      result[state] = row as Record<S, number>;
    }

    return result as Record<S, Record<S, number>>;
  }

  expectedTimeToAbsorption(): Record<S, number> {
    const transient = this.transientStates();
    const absorbing = this.absorbingStates();
    const n = this.fundamentalMatrix();
    const result: Partial<Record<S, number>> = {};

    for (let i = 0; i < transient.length; i++) {
      result[transient[i]!] = n[i]!.reduce((total, value) => total + value, 0);
    }
    for (const state of absorbing) {
      result[state] = 0;
    }

    return result as Record<S, number>;
  }

  private canonicalBlocks(): { transient: S[]; absorbing: S[]; q: Matrix; r: Matrix } {
    const transient = this.transientStates();
    const absorbing = this.absorbingStates();

    const q = transient.map((from) =>
      transient.map((to) => this.chain.transitionProbability(from, to)),
    );
    const r = transient.map((from) =>
      absorbing.map((to) => this.chain.transitionProbability(from, to)),
    );

    return { transient, absorbing, q, r };
  }
}
