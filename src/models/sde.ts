import { type Rng, assertFiniteNumber, rngOrDefault } from "./core.ts";

export interface DiffusionPoint {
  time: number;
  value: number;
}

export interface DiffusionPathOptions {
  initial: number;
  dt: number;
  steps: number;
  rng?: Rng;
}

export interface DiffusionSummary {
  mean: number;
  variance: number;
  terminals: number[];
}

type StepOverride = (value: number, dt: number, rng: Rng) => number;

export class Diffusion1D {
  readonly drift: (value: number, time: number) => number;
  readonly volatility: (value: number, time: number) => number;
  private readonly exactStep?: StepOverride;

  constructor(
    drift: (value: number, time: number) => number,
    volatility: (value: number, time: number) => number,
    exactStep?: StepOverride,
  ) {
    this.drift = drift;
    this.volatility = volatility;
    this.exactStep = exactStep;
  }

  simulatePath(options: DiffusionPathOptions): DiffusionPoint[] {
    validatePathOptions(options);
    const rng = rngOrDefault(options.rng);
    const path: DiffusionPoint[] = [{ time: 0, value: options.initial }];
    let value = options.initial;
    for (let step = 1; step <= options.steps; step++) {
      const time = (step - 1) * options.dt;
      if (this.exactStep) {
        value = this.exactStep(value, options.dt, rng);
      } else {
        const drift = this.drift(value, time);
        const volatility = this.volatility(value, time);
        assertFiniteNumber(drift, "Diffusion drift");
        assertFiniteNumber(volatility, "Diffusion volatility");
        value += drift * options.dt + volatility * rng.normal(0, Math.sqrt(options.dt));
      }
      assertFiniteNumber(value, "Diffusion value");
      path.push({ time: step * options.dt, value });
    }
    return path;
  }

  simulateMany(options: DiffusionPathOptions & { paths: number }): DiffusionPoint[][] {
    if (!Number.isInteger(options.paths) || options.paths <= 0) {
      throw new Error(`Path count must be a positive integer; received ${options.paths}`);
    }
    const paths: DiffusionPoint[][] = [];
    for (let index = 0; index < options.paths; index++) {
      paths.push(this.simulatePath(options));
    }
    return paths;
  }

  terminalSummary(options: DiffusionPathOptions & { paths: number }): DiffusionSummary {
    const terminals = this.simulateMany(options).map((path) => path.at(-1)!.value);
    const mean = terminals.reduce((total, value) => total + value, 0) / terminals.length;
    const variance = terminals.reduce((total, value) => total + (value - mean) ** 2, 0) / terminals.length;
    return { mean, variance, terminals };
  }
}

export function brownianMotion(volatility = 1): Diffusion1D {
  assertPositive(volatility, "Brownian volatility");
  return new Diffusion1D(() => 0, () => volatility);
}

export function ornsteinUhlenbeck(config: {
  mean: number;
  theta: number;
  volatility: number;
}): Diffusion1D {
  assertFiniteNumber(config.mean, "OU mean");
  assertPositive(config.theta, "OU theta");
  assertPositive(config.volatility, "OU volatility");
  return new Diffusion1D(
    (value) => config.theta * (config.mean - value),
    () => config.volatility,
  );
}

export function geometricBrownianMotion(config: {
  drift: number;
  volatility: number;
}): Diffusion1D {
  assertFiniteNumber(config.drift, "GBM drift");
  assertPositive(config.volatility, "GBM volatility");
  return new Diffusion1D(
    (value) => config.drift * value,
    (value) => config.volatility * value,
    (value, dt, rng) =>
      value * Math.exp((config.drift - 0.5 * config.volatility ** 2) * dt + config.volatility * rng.normal(0, Math.sqrt(dt))),
  );
}

export function langevinDiffusion1D(
  gradientLogDensity: (value: number) => number,
  noiseScale = 1,
): Diffusion1D {
  assertPositive(noiseScale, "Langevin noise scale");
  return new Diffusion1D(
    (value) => 0.5 * noiseScale ** 2 * gradientLogDensity(value),
    () => noiseScale,
  );
}

function validatePathOptions(options: DiffusionPathOptions) {
  assertFiniteNumber(options.initial, "Initial value");
  assertPositive(options.dt, "Time step");
  if (!Number.isInteger(options.steps) || options.steps < 0) {
    throw new Error(`Steps must be a nonnegative integer; received ${options.steps}`);
  }
}

function assertPositive(value: number, label: string) {
  assertFiniteNumber(value, label);
  if (value <= 0) {
    throw new Error(`${label} must be positive; received ${value}`);
  }
}
