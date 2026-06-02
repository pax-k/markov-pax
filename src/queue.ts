export interface BirthDeathProcessConfig {
  birthRate: (state: number) => number;
  deathRate: (state: number) => number;
}

export class BirthDeathProcess {
  readonly birthRate: (state: number) => number;
  readonly deathRate: (state: number) => number;

  constructor(config: BirthDeathProcessConfig) {
    this.birthRate = config.birthRate;
    this.deathRate = config.deathRate;
  }

  stationaryDistribution(maxState: number): Record<number, number> {
    if (!Number.isInteger(maxState) || maxState < 0) {
      throw new Error(`maxState must be a nonnegative integer; received ${maxState}`);
    }

    const weights = Array(maxState + 1).fill(0) as number[];
    weights[0] = 1;

    for (let n = 1; n <= maxState; n++) {
      const birth = this.birthRate(n - 1);
      const death = this.deathRate(n);
      if (!Number.isFinite(birth) || birth < 0) {
        throw new Error(`Birth rate at ${n - 1} must be nonnegative`);
      }
      if (!Number.isFinite(death) || death <= 0) {
        throw new Error(`Death rate at ${n} must be positive`);
      }
      weights[n] = weights[n - 1]! * birth / death;
    }

    const total = weights.reduce((acc, value) => acc + value, 0);
    const result: Record<number, number> = {};
    for (let n = 0; n <= maxState; n++) {
      result[n] = weights[n]! / total;
    }
    return result;
  }
}

export interface MM1QueueConfig {
  arrivalRate: number;
  serviceRate: number;
}

export class MM1Queue {
  readonly arrivalRate: number;
  readonly serviceRate: number;

  constructor(config: MM1QueueConfig) {
    if (!Number.isFinite(config.arrivalRate) || config.arrivalRate < 0) {
      throw new Error("arrivalRate must be nonnegative");
    }
    if (!Number.isFinite(config.serviceRate) || config.serviceRate <= 0) {
      throw new Error("serviceRate must be positive");
    }
    if (config.arrivalRate >= config.serviceRate) {
      throw new Error("M/M/1 queue is unstable when arrivalRate >= serviceRate");
    }

    this.arrivalRate = config.arrivalRate;
    this.serviceRate = config.serviceRate;
  }

  rho(): number {
    return this.arrivalRate / this.serviceRate;
  }

  stationaryProbability(state: number): number {
    if (!Number.isInteger(state) || state < 0) {
      throw new Error(`State must be a nonnegative integer; received ${state}`);
    }
    const rho = this.rho();
    return (1 - rho) * rho ** state;
  }

  expectedNumberInSystem(): number {
    const rho = this.rho();
    return rho / (1 - rho);
  }

  expectedNumberInQueue(): number {
    const rho = this.rho();
    return rho ** 2 / (1 - rho);
  }

  expectedTimeInSystem(): number {
    return 1 / (this.serviceRate - this.arrivalRate);
  }

  expectedTimeInQueue(): number {
    return this.rho() / (this.serviceRate - this.arrivalRate);
  }
}
