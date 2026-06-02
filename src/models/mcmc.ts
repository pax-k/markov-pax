import { type Rng, rngOrDefault } from "./core.ts";

export interface SamplerRunOptions {
  iterations: number;
  burnIn?: number;
  thin?: number;
}

export interface SamplerResult<T> {
  samples: T[];
  accepted: number;
  acceptanceRate: number;
  mean(): number;
  variance(): number;
}

export interface MetropolisHastingsConfig<T> {
  initial: T;
  logTarget: (value: T) => number;
  proposal: (current: T, rng: Rng) => T;
  logProposalRatio?: (current: T, proposed: T) => number;
  rng?: Rng;
}

export function metropolisHastings<T>(config: MetropolisHastingsConfig<T>) {
  return {
    run(options: SamplerRunOptions): SamplerResult<T> {
      validateRunOptions(options);
      const rng = rngOrDefault(config.rng);
      const burnIn = options.burnIn ?? 0;
      const thin = options.thin ?? 1;
      let current = config.initial;
      let currentLogTarget = config.logTarget(current);
      let accepted = 0;
      const samples: T[] = [];

      for (let iteration = 0; iteration < options.iterations; iteration++) {
        const proposed = config.proposal(current, rng);
        const proposedLogTarget = config.logTarget(proposed);
        const proposalRatio = config.logProposalRatio?.(current, proposed) ?? 0;
        const logAccept = proposedLogTarget - currentLogTarget + proposalRatio;

        if (Math.log(Math.max(rng.next(), Number.MIN_VALUE)) < Math.min(0, logAccept)) {
          current = proposed;
          currentLogTarget = proposedLogTarget;
          accepted++;
        }

        if (iteration >= burnIn && (iteration - burnIn) % thin === 0) {
          samples.push(current);
        }
      }

      return createSamplerResult(samples, accepted, accepted / options.iterations);
    },
  };
}

export interface GibbsStep<T extends Record<string, number>, K extends keyof T = keyof T> {
  key: K;
  sample: (state: T, rng: Rng) => T[K];
}

export interface GibbsSamplerConfig<T extends Record<string, number>> {
  initial: T;
  steps: GibbsStep<T>[];
  rng?: Rng;
}

export function gibbsSampler<T extends Record<string, number>>(config: GibbsSamplerConfig<T>) {
  if (config.steps.length === 0) {
    throw new Error("Gibbs sampler requires at least one conditional step");
  }

  return {
    run(options: SamplerRunOptions): SamplerResult<T> {
      validateRunOptions(options);
      const rng = rngOrDefault(config.rng);
      const burnIn = options.burnIn ?? 0;
      const thin = options.thin ?? 1;
      let state = { ...config.initial };
      const samples: T[] = [];

      for (let iteration = 0; iteration < options.iterations; iteration++) {
        for (const step of config.steps) {
          state = { ...state, [step.key]: step.sample(state, rng) };
        }

        if (iteration >= burnIn && (iteration - burnIn) % thin === 0) {
          samples.push({ ...state });
        }
      }

      return createSamplerResult(samples, options.iterations, 1);
    },
  };
}

function validateRunOptions(options: SamplerRunOptions) {
  if (!Number.isInteger(options.iterations) || options.iterations <= 0) {
    throw new Error(`iterations must be a positive integer; received ${options.iterations}`);
  }
  if (options.burnIn !== undefined && (!Number.isInteger(options.burnIn) || options.burnIn < 0)) {
    throw new Error(`burnIn must be a nonnegative integer; received ${options.burnIn}`);
  }
  if ((options.burnIn ?? 0) >= options.iterations) {
    throw new Error("burnIn must be smaller than iterations");
  }
  if (options.thin !== undefined && (!Number.isInteger(options.thin) || options.thin <= 0)) {
    throw new Error(`thin must be a positive integer; received ${options.thin}`);
  }
}

function createSamplerResult<T>(
  samples: T[],
  accepted: number,
  acceptanceRate: number,
): SamplerResult<T> {
  return {
    samples,
    accepted,
    acceptanceRate,
    mean() {
      const numeric = numericSamples(samples);
      return numeric.reduce((total, value) => total + value, 0) / numeric.length;
    },
    variance() {
      const numeric = numericSamples(samples);
      const mean = numeric.reduce((total, value) => total + value, 0) / numeric.length;
      return numeric.reduce((total, value) => total + (value - mean) ** 2, 0) / numeric.length;
    },
  };
}

function numericSamples<T>(samples: T[]): number[] {
  if (!samples.every((sample) => typeof sample === "number")) {
    throw new Error("Numeric summary is only available for number-valued samples");
  }
  return samples as number[];
}
