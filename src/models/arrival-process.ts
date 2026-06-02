import { type Rng, rngOrDefault } from "./core.ts";

export interface PiecewiseConstantRate {
  start: number;
  end: number;
  rate: number;
}

export class NonHomogeneousPoissonProcess {
  readonly intervals: PiecewiseConstantRate[];

  constructor(intervals: readonly PiecewiseConstantRate[]) {
    if (intervals.length === 0) {
      throw new Error("NonHomogeneousPoissonProcess requires at least one interval");
    }
    this.intervals = intervals.map((interval) => ({ ...interval }));
    for (let index = 0; index < this.intervals.length; index++) {
      const interval = this.intervals[index]!;
      assertFinite(interval.start, "interval start");
      assertFinite(interval.end, "interval end");
      assertNonnegative(interval.rate, "interval rate");
      if (interval.end <= interval.start) {
        throw new Error("interval end must be greater than interval start");
      }
      if (index > 0 && interval.start < this.intervals[index - 1]!.end) {
        throw new Error("piecewise intervals must be sorted and non-overlapping");
      }
    }
  }

  rateAt(time: number): number {
    assertNonnegative(time, "time");
    for (const interval of this.intervals) {
      if (time >= interval.start && time < interval.end) {
        return interval.rate;
      }
    }
    return 0;
  }

  expectedCount(end: number): number;
  expectedCount(start: number, end: number): number;
  expectedCount(startOrEnd: number, maybeEnd?: number): number {
    const start = maybeEnd === undefined ? 0 : startOrEnd;
    const end = maybeEnd === undefined ? startOrEnd : maybeEnd;
    assertNonnegative(start, "start");
    assertNonnegative(end, "end");
    if (end < start) {
      throw new Error("end must be at least start");
    }
    let total = 0;
    for (const interval of this.intervals) {
      const overlapStart = Math.max(start, interval.start);
      const overlapEnd = Math.min(end, interval.end);
      if (overlapEnd > overlapStart) {
        total += (overlapEnd - overlapStart) * interval.rate;
      }
    }
    return total;
  }

  eventTimesUntil(horizon: number, options: { rng?: Rng } = {}): number[] {
    assertNonnegative(horizon, "horizon");
    const rng = rngOrDefault(options.rng);
    const events: number[] = [];
    for (const interval of this.intervals) {
      const intervalStart = Math.max(0, interval.start);
      const intervalEnd = Math.min(horizon, interval.end);
      if (intervalEnd <= intervalStart || interval.rate === 0) continue;
      let time = intervalStart;
      while (time < intervalEnd) {
        time += rng.exponential(interval.rate);
        if (time <= intervalEnd) events.push(time);
      }
    }
    return events;
  }

  countBy(horizon: number, options: { rng?: Rng } = {}): number {
    return this.eventTimesUntil(horizon, options).length;
  }
}

function assertFinite(value: number, label: string) {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be finite`);
  }
}

function assertNonnegative(value: number, label: string) {
  assertFinite(value, label);
  if (value < 0) {
    throw new Error(`${label} must be nonnegative`);
  }
}
