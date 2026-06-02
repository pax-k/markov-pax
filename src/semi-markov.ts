import {
  type Distribution,
  type Rng,
  type WeightedTransitions,
  assertFiniteNumber,
  rngOrDefault,
  sampleIndex,
} from "./core.ts";
import { MarkovChain } from "./markov-chain.ts";

export interface HoldingTimeDistribution {
  sample(rng: Rng): number;
  mean(): number;
}

export interface SemiMarkovEvent<S extends string> {
  state: S;
  start: number;
  end: number;
  duration: number;
}

export function deterministicHoldingTime(duration: number): HoldingTimeDistribution {
  assertPositive(duration, "Holding duration");
  return {
    sample() {
      return duration;
    },
    mean() {
      return duration;
    },
  };
}

export function exponentialHoldingTime(rate: number): HoldingTimeDistribution {
  assertPositive(rate, "Holding rate");
  return {
    sample(rng: Rng) {
      return rng.exponential(rate);
    },
    mean() {
      return 1 / rate;
    },
  };
}

export function uniformHoldingTime(min: number, max: number): HoldingTimeDistribution {
  assertPositive(min, "Minimum holding time");
  assertPositive(max, "Maximum holding time");
  if (max < min) {
    throw new Error("Maximum holding time must be at least the minimum");
  }
  return {
    sample(rng: Rng) {
      return min + (max - min) * rng.next();
    },
    mean() {
      return (min + max) / 2;
    },
  };
}

export function empiricalHoldingTime(values: readonly number[]): HoldingTimeDistribution {
  if (values.length === 0) {
    throw new Error("Empirical holding time requires at least one value");
  }
  for (const value of values) {
    assertPositive(value, "Empirical holding time");
  }
  return {
    sample(rng: Rng) {
      return values[sampleIndex(Array(values.length).fill(1), rng)]!;
    },
    mean() {
      return values.reduce((total, value) => total + value, 0) / values.length;
    },
  };
}

export class SemiMarkovProcess<S extends string> {
  readonly chain: MarkovChain<S>;
  readonly holdingTimes: Record<S, HoldingTimeDistribution>;

  constructor(
    transitions: WeightedTransitions<S>,
    holdingTimes: Record<S, HoldingTimeDistribution>,
    options: { normalize?: boolean } = {},
  ) {
    this.chain = MarkovChain.from(transitions, options);
    this.holdingTimes = holdingTimes;
    for (const state of this.chain.states) {
      if (!this.holdingTimes[state]) {
        throw new Error(`Missing holding time distribution for state ${String(state)}`);
      }
    }
  }

  static from<S extends string>(
    transitions: WeightedTransitions<S>,
    holdingTimes: Record<S, HoldingTimeDistribution>,
    options: { normalize?: boolean } = {},
  ): SemiMarkovProcess<S> {
    return new SemiMarkovProcess(transitions, holdingTimes, options);
  }

  simulateUntil(timeHorizon: number, start: S, options: { rng?: Rng } = {}): SemiMarkovEvent<S>[] {
    assertPositive(timeHorizon, "Time horizon");
    const rng = rngOrDefault(options.rng);
    const events: SemiMarkovEvent<S>[] = [];
    let time = 0;
    let current = start;

    while (time < timeHorizon) {
      const duration = this.holdingTimes[current]!.sample(rng);
      assertPositive(duration, `Holding time for ${String(current)}`);
      const end = Math.min(time + duration, timeHorizon);
      events.push({ state: current, start: time, end, duration: end - time });
      time = end;
      if (time >= timeHorizon) break;
      const row = this.chain.toVector(this.chain.stepFrom(current));
      current = this.chain.states[sampleIndex(row, rng)]!;
    }

    return events;
  }

  occupancyTimes(events: readonly SemiMarkovEvent<S>[]): Distribution<S> {
    const result: Partial<Record<S, number>> = {};
    for (const state of this.chain.states) {
      result[state] = 0;
    }
    for (const event of events) {
      result[event.state] = (result[event.state] ?? 0) + event.duration;
    }
    return result as Distribution<S>;
  }

  embeddedChain(): MarkovChain<S> {
    return this.chain;
  }
}

function assertPositive(value: number, label: string) {
  assertFiniteNumber(value, label);
  if (value <= 0) {
    throw new Error(`${label} must be positive; received ${value}`);
  }
}
