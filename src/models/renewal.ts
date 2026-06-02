import { type Rng, assertFiniteNumber, rngOrDefault } from "./core.ts";
import { type HoldingTimeDistribution } from "./semi-markov.ts";

export class RenewalProcess {
  readonly waitingTime: HoldingTimeDistribution;

  constructor(waitingTime: HoldingTimeDistribution) {
    this.waitingTime = waitingTime;
  }

  eventTimesUntil(horizon: number, options: { rng?: Rng } = {}): number[] {
    assertPositive(horizon, "Renewal horizon");
    const rng = rngOrDefault(options.rng);
    const events: number[] = [];
    let time = 0;
    while (time < horizon) {
      const wait = this.waitingTime.sample(rng);
      assertPositive(wait, "Renewal waiting time");
      time += wait;
      if (time <= horizon) {
        events.push(time);
      }
    }
    return events;
  }

  countBy(time: number, options: { rng?: Rng } = {}): number {
    return this.eventTimesUntil(time, options).length;
  }

  estimateRenewalRate(horizon: number, options: { rng?: Rng } = {}): number {
    return this.countBy(horizon, options) / horizon;
  }
}

export function renewalReward(
  process: RenewalProcess,
  horizon: number,
  rewardPerRenewal: number,
  options: { rng?: Rng } = {},
): number {
  assertFiniteNumber(rewardPerRenewal, "Reward per renewal");
  return process.countBy(horizon, options) * rewardPerRenewal;
}

export function estimateRenewalRate(
  process: RenewalProcess,
  horizon: number,
  options: { rng?: Rng } = {},
): number {
  return process.estimateRenewalRate(horizon, options);
}

function assertPositive(value: number, label: string) {
  assertFiniteNumber(value, label);
  if (value <= 0) {
    throw new Error(`${label} must be positive; received ${value}`);
  }
}
