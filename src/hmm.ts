import {
  type Distribution,
  type Rng,
  assertProbability,
  distributionToVector,
  sampleIndex,
  uniqueValues,
  vectorToDistribution,
} from "./core.ts";

export interface HMMConfig<S extends string, O extends string> {
  states: readonly S[];
  observations: readonly O[];
  initial: Partial<Record<S, number>>;
  transition: Record<S, Partial<Record<S, number>>>;
  emission: Record<S, Partial<Record<O, number>>>;
}

export interface ForwardResult<S extends string> {
  probability: number;
  logProbability: number;
  posterior: Distribution<S>;
  alpha: number[][];
  scales: number[];
}

export interface ViterbiResult<S extends string> {
  path: S[];
  probability: number;
  logProbability: number;
}

export interface HMMSample<S extends string, O extends string> {
  states: S[];
  observations: O[];
}

export class HiddenMarkovModel<S extends string, O extends string> {
  readonly states: S[];
  readonly observations: O[];
  readonly initial: number[];
  readonly transition: number[][];
  readonly emission: number[][];
  private readonly stateIndex: Map<S, number>;
  private readonly observationIndex: Map<O, number>;

  constructor(config: HMMConfig<S, O>) {
    this.states = uniqueValues(config.states, "state");
    this.observations = uniqueValues(config.observations, "observation");
    this.stateIndex = new Map(this.states.map((state, index) => [state, index]));
    this.observationIndex = new Map(this.observations.map((observation, index) => [observation, index]));

    this.initial = distributionToVector(this.states, config.initial);
    this.transition = this.states.map((from) =>
      distributionToVector(this.states, config.transition[from] ?? {}),
    );
    this.emission = this.states.map((state) =>
      distributionToVector(this.observations, config.emission[state] ?? {}),
    );
  }

  static from<S extends string, O extends string>(config: HMMConfig<S, O>): HiddenMarkovModel<S, O> {
    return new HiddenMarkovModel(config);
  }

  forward(sequence: readonly O[]): ForwardResult<S> {
    if (sequence.length === 0) {
      throw new Error("Observation sequence must not be empty");
    }

    const indices = sequence.map((observation) => this.indexOfObservation(observation));
    const alpha: number[][] = [];
    const scales: number[] = [];

    let current = this.initial.map((probability, stateIndex) =>
      probability * this.emission[stateIndex]![indices[0]!]!,
    );
    let scale = current.reduce((total, value) => total + value, 0);
    if (scale <= 0) {
      throw new Error("Observation sequence has zero probability");
    }
    current = current.map((value) => value / scale);
    alpha.push(current);
    scales.push(scale);

    for (let t = 1; t < indices.length; t++) {
      const next = Array(this.states.length).fill(0) as number[];
      for (let to = 0; to < this.states.length; to++) {
        let probability = 0;
        for (let from = 0; from < this.states.length; from++) {
          probability += current[from]! * this.transition[from]![to]!;
        }
        next[to] = probability * this.emission[to]![indices[t]!]!;
      }
      scale = next.reduce((total, value) => total + value, 0);
      if (scale <= 0) {
        throw new Error("Observation sequence has zero probability");
      }
      current = next.map((value) => value / scale);
      alpha.push(current);
      scales.push(scale);
    }

    const logProbability = scales.reduce((total, value) => total + Math.log(value), 0);
    return {
      probability: Math.exp(logProbability),
      logProbability,
      posterior: vectorToDistribution(this.states, alpha.at(-1)!),
      alpha,
      scales,
    };
  }

  backward(sequence: readonly O[]): number[][] {
    if (sequence.length === 0) {
      throw new Error("Observation sequence must not be empty");
    }

    const indices = sequence.map((observation) => this.indexOfObservation(observation));
    const beta = Array.from({ length: sequence.length }, () =>
      Array(this.states.length).fill(0) as number[],
    );
    beta[sequence.length - 1] = Array(this.states.length).fill(1);

    for (let t = sequence.length - 2; t >= 0; t--) {
      for (let from = 0; from < this.states.length; from++) {
        let probability = 0;
        for (let to = 0; to < this.states.length; to++) {
          probability += this.transition[from]![to]! *
            this.emission[to]![indices[t + 1]!]! *
            beta[t + 1]![to]!;
        }
        beta[t]![from] = probability;
      }
    }

    return beta;
  }

  sequenceProbability(sequence: readonly O[]): number {
    return this.forward(sequence).probability;
  }

  viterbi(sequence: readonly O[]): ViterbiResult<S> {
    if (sequence.length === 0) {
      throw new Error("Observation sequence must not be empty");
    }

    const indices = sequence.map((observation) => this.indexOfObservation(observation));
    const logDelta = Array.from({ length: sequence.length }, () =>
      Array(this.states.length).fill(Number.NEGATIVE_INFINITY) as number[],
    );
    const backPointer = Array.from({ length: sequence.length }, () =>
      Array(this.states.length).fill(0) as number[],
    );

    for (let state = 0; state < this.states.length; state++) {
      logDelta[0]![state] = safeLog(this.initial[state]!) + safeLog(this.emission[state]![indices[0]!]!);
    }

    for (let t = 1; t < sequence.length; t++) {
      for (let to = 0; to < this.states.length; to++) {
        let best = Number.NEGATIVE_INFINITY;
        let bestState = 0;
        for (let from = 0; from < this.states.length; from++) {
          const candidate = logDelta[t - 1]![from]! + safeLog(this.transition[from]![to]!);
          if (candidate > best) {
            best = candidate;
            bestState = from;
          }
        }
        logDelta[t]![to] = best + safeLog(this.emission[to]![indices[t]!]!);
        backPointer[t]![to] = bestState;
      }
    }

    let bestFinal = 0;
    let bestLogProbability = Number.NEGATIVE_INFINITY;
    for (let state = 0; state < this.states.length; state++) {
      if (logDelta[sequence.length - 1]![state]! > bestLogProbability) {
        bestLogProbability = logDelta[sequence.length - 1]![state]!;
        bestFinal = state;
      }
    }

    const pathIndices = Array(sequence.length).fill(0) as number[];
    pathIndices[sequence.length - 1] = bestFinal;
    for (let t = sequence.length - 1; t > 0; t--) {
      pathIndices[t - 1] = backPointer[t]![pathIndices[t]!]!;
    }

    return {
      path: pathIndices.map((index) => this.states[index]!),
      probability: Math.exp(bestLogProbability),
      logProbability: bestLogProbability,
    };
  }

  sample(length: number, options: { rng?: Rng } = {}): HMMSample<S, O> {
    if (!Number.isInteger(length) || length < 0) {
      throw new Error(`Sample length must be a nonnegative integer; received ${length}`);
    }

    const states: S[] = [];
    const observations: O[] = [];
    if (length === 0) return { states, observations };

    let currentState = sampleIndex(this.initial, options.rng);
    for (let i = 0; i < length; i++) {
      states.push(this.states[currentState]!);
      const observationIndex = sampleIndex(this.emission[currentState]!, options.rng);
      observations.push(this.observations[observationIndex]!);
      if (i < length - 1) {
        currentState = sampleIndex(this.transition[currentState]!, options.rng);
      }
    }

    return { states, observations };
  }

  private indexOfObservation(observation: O): number {
    const index = this.observationIndex.get(observation);
    if (index === undefined) {
      throw new Error(`Unknown observation: ${String(observation)}`);
    }
    return index;
  }
}

function safeLog(probability: number): number {
  assertProbability(probability);
  return probability === 0 ? Number.NEGATIVE_INFINITY : Math.log(probability);
}
