import { type Rng, assertFiniteNumber, rngOrDefault } from "../shared/core.ts";
import { autocorrelation, effectiveSampleSize } from "../chains/ergodic.ts";
import { type SamplerResult, type SamplerRunOptions } from "./mcmc.ts";

export interface MalaConfig {
  initial: number;
  logTarget: (value: number) => number;
  gradientLogTarget: (value: number) => number;
  stepSize: number;
  rng?: Rng;
}

export interface HMCConfig extends MalaConfig {
  leapfrogSteps: number;
  mass?: number;
}

export function mala(config: MalaConfig) {
  validateStepSize(config.stepSize);
  return {
    run(options: SamplerRunOptions): SamplerResult<number> {
      validateRunOptions(options);
      const rng = rngOrDefault(config.rng);
      let current = config.initial;
      let currentLogTarget = checked(config.logTarget(current), "Current log target");
      let accepted = 0;
      const samples: number[] = [];
      const burnIn = options.burnIn ?? 0;
      const thin = options.thin ?? 1;

      for (let iteration = 0; iteration < options.iterations; iteration++) {
        const currentGradient = checked(config.gradientLogTarget(current), "Current gradient");
        const meanForward = current + 0.5 * config.stepSize ** 2 * currentGradient;
        const proposed = meanForward + config.stepSize * rng.normal();
        const proposedLogTarget = checked(config.logTarget(proposed), "Proposed log target");
        const proposedGradient = checked(config.gradientLogTarget(proposed), "Proposed gradient");
        const meanReverse = proposed + 0.5 * config.stepSize ** 2 * proposedGradient;
        const logAccept = proposedLogTarget - currentLogTarget +
          gaussianLogDensity(current, meanReverse, config.stepSize) -
          gaussianLogDensity(proposed, meanForward, config.stepSize);

        if (Math.log(Math.max(rng.next(), Number.MIN_VALUE)) < Math.min(0, logAccept)) {
          current = proposed;
          currentLogTarget = proposedLogTarget;
          accepted++;
        }

        if (iteration >= burnIn && (iteration - burnIn) % thin === 0) {
          samples.push(current);
        }
      }

      return samplerResult(samples, accepted, accepted / options.iterations);
    },
  };
}

export function hamiltonianMonteCarlo(config: HMCConfig) {
  validateStepSize(config.stepSize);
  if (!Number.isInteger(config.leapfrogSteps) || config.leapfrogSteps <= 0) {
    throw new Error(`leapfrogSteps must be a positive integer; received ${config.leapfrogSteps}`);
  }
  const mass = config.mass ?? 1;
  if (!Number.isFinite(mass) || mass <= 0) {
    throw new Error(`Mass must be positive; received ${mass}`);
  }

  return {
    run(options: SamplerRunOptions): SamplerResult<number> {
      validateRunOptions(options);
      const rng = rngOrDefault(config.rng);
      let current = config.initial;
      let accepted = 0;
      const samples: number[] = [];
      const burnIn = options.burnIn ?? 0;
      const thin = options.thin ?? 1;

      for (let iteration = 0; iteration < options.iterations; iteration++) {
        let position = current;
        let momentum = rng.normal(0, Math.sqrt(mass));
        const initialMomentum = momentum;
        momentum += 0.5 * config.stepSize * checked(config.gradientLogTarget(position), "Initial gradient");
        for (let step = 0; step < config.leapfrogSteps; step++) {
          position += config.stepSize * momentum / mass;
          const gradient = checked(config.gradientLogTarget(position), "Leapfrog gradient");
          momentum += (step === config.leapfrogSteps - 1 ? 0.5 : 1) * config.stepSize * gradient;
        }
        momentum = -momentum;

        const currentEnergy = -checked(config.logTarget(current), "Current log target") +
          initialMomentum ** 2 / (2 * mass);
        const proposedEnergy = -checked(config.logTarget(position), "Proposed log target") +
          momentum ** 2 / (2 * mass);
        const logAccept = currentEnergy - proposedEnergy;
        if (Math.log(Math.max(rng.next(), Number.MIN_VALUE)) < Math.min(0, logAccept)) {
          current = position;
          accepted++;
        }
        if (iteration >= burnIn && (iteration - burnIn) % thin === 0) {
          samples.push(current);
        }
      }

      return samplerResult(samples, accepted, accepted / options.iterations);
    },
  };
}

export function gaussianRandomWalkProposal(standardDeviation: number): (current: number, rng: Rng) => number {
  validateStepSize(standardDeviation);
  return (current, rng) => current + rng.normal(0, standardDeviation);
}

export function validateGradient(
  logTarget: (value: number) => number,
  gradient: (value: number) => number,
  at: number,
  epsilon = 1e-5,
): number {
  validateStepSize(epsilon);
  const finiteDifference = (checked(logTarget(at + epsilon), "Forward log target") -
    checked(logTarget(at - epsilon), "Backward log target")) / (2 * epsilon);
  return Math.abs(finiteDifference - checked(gradient(at), "Analytic gradient"));
}

export function diagnoseChain(samples: readonly number[]): {
  mean: number;
  variance: number;
  autocorrelation1: number;
  effectiveSampleSize: number;
} {
  if (samples.length < 2) {
    throw new Error("At least two samples are required for diagnostics");
  }
  const mean = samples.reduce((total, value) => total + value, 0) / samples.length;
  const variance = samples.reduce((total, value) => total + (value - mean) ** 2, 0) / samples.length;
  return {
    mean,
    variance,
    autocorrelation1: autocorrelation(samples, 1),
    effectiveSampleSize: effectiveSampleSize(samples),
  };
}

export function gelmanRubinRHat(chains: readonly (readonly number[])[]): number {
  if (chains.length < 2) {
    throw new Error("At least two chains are required for R-hat");
  }
  const length = chains[0]!.length;
  if (length < 2 || !chains.every((chain) => chain.length === length)) {
    throw new Error("All chains must have the same length of at least two");
  }
  const means = chains.map((chain) => chain.reduce((total, value) => total + value, 0) / length);
  const meanOfMeans = means.reduce((total, value) => total + value, 0) / means.length;
  const between = length * means.reduce((total, mean) => total + (mean - meanOfMeans) ** 2, 0) / (chains.length - 1);
  const within = chains.reduce((total, chain, index) => {
    const mean = means[index]!;
    return total + chain.reduce((acc, value) => acc + (value - mean) ** 2, 0) / (length - 1);
  }, 0) / chains.length;
  if (within === 0) {
    return between === 0 ? 1 : Number.POSITIVE_INFINITY;
  }
  const varianceEstimate = ((length - 1) / length) * within + between / length;
  return Math.sqrt(varianceEstimate / within);
}

export function diagnoseChains(chains: readonly (readonly number[])[]): {
  rHat: number;
  summaries: ReturnType<typeof diagnoseChain>[];
} {
  return {
    rHat: gelmanRubinRHat(chains),
    summaries: chains.map((chain) => diagnoseChain(chain)),
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

function validateStepSize(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Step size must be positive; received ${value}`);
  }
}

function checked(value: number, label: string): number {
  assertFiniteNumber(value, label);
  return value;
}

function gaussianLogDensity(value: number, mean: number, standardDeviation: number): number {
  return -0.5 * ((value - mean) / standardDeviation) ** 2;
}

function samplerResult(samples: number[], accepted: number, acceptanceRate: number): SamplerResult<number> {
  return {
    samples,
    accepted,
    acceptanceRate,
    mean() {
      return samples.reduce((total, value) => total + value, 0) / samples.length;
    },
    variance() {
      const mean = this.mean();
      return samples.reduce((total, value) => total + (value - mean) ** 2, 0) / samples.length;
    },
  };
}
