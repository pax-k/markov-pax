import {
  DEFAULT_TOLERANCE,
  type Distribution,
  type Matrix,
  solveLinearSystem,
  uniqueValues,
} from "../shared/core.ts";

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

export interface MMcQueueConfig {
  arrivalRate: number;
  serviceRate: number;
  servers: number;
}

export class MMcQueue {
  readonly arrivalRate: number;
  readonly serviceRate: number;
  readonly servers: number;

  constructor(config: MMcQueueConfig) {
    assertNonnegative(config.arrivalRate, "arrivalRate");
    assertPositive(config.serviceRate, "serviceRate");
    assertPositiveInteger(config.servers, "servers");
    if (config.arrivalRate >= config.servers * config.serviceRate) {
      throw new Error("M/M/c queue is unstable when arrivalRate >= servers * serviceRate");
    }
    this.arrivalRate = config.arrivalRate;
    this.serviceRate = config.serviceRate;
    this.servers = config.servers;
  }

  rho(): number {
    return this.arrivalRate / (this.servers * this.serviceRate);
  }

  utilization(): number {
    return this.rho();
  }

  idleProbability(): number {
    const offeredLoad = this.arrivalRate / this.serviceRate;
    let sum = 0;
    for (let n = 0; n < this.servers; n++) {
      sum += offeredLoad ** n / factorial(n);
    }
    const tail = offeredLoad ** this.servers / (factorial(this.servers) * (1 - this.rho()));
    return 1 / (sum + tail);
  }

  erlangC(): number {
    const offeredLoad = this.arrivalRate / this.serviceRate;
    return this.idleProbability() *
      offeredLoad ** this.servers /
      (factorial(this.servers) * (1 - this.rho()));
  }

  probabilityOfWait(): number {
    return this.erlangC();
  }

  stationaryProbability(state: number): number {
    assertNonnegativeInteger(state, "state");
    const offeredLoad = this.arrivalRate / this.serviceRate;
    if (state < this.servers) {
      return this.idleProbability() * offeredLoad ** state / factorial(state);
    }
    return this.idleProbability() *
      offeredLoad ** this.servers /
      factorial(this.servers) *
      this.rho() ** (state - this.servers);
  }

  expectedNumberInQueue(): number {
    return this.erlangC() * this.rho() / (1 - this.rho());
  }

  expectedNumberInSystem(): number {
    return this.expectedNumberInQueue() + this.arrivalRate / this.serviceRate;
  }

  expectedTimeInQueue(): number {
    return this.arrivalRate === 0 ? 0 : this.expectedNumberInQueue() / this.arrivalRate;
  }

  expectedTimeInSystem(): number {
    return this.expectedTimeInQueue() + 1 / this.serviceRate;
  }
}

export interface FiniteCapacityQueueConfig {
  capacity: number;
  birthRate: (state: number) => number;
  deathRate: (state: number) => number;
}

export class FiniteCapacityQueue {
  readonly capacity: number;
  readonly birthRate: (state: number) => number;
  readonly deathRate: (state: number) => number;

  constructor(config: FiniteCapacityQueueConfig) {
    assertNonnegativeInteger(config.capacity, "capacity");
    this.capacity = config.capacity;
    this.birthRate = config.birthRate;
    this.deathRate = config.deathRate;
  }

  stationaryDistribution(): Record<number, number> {
    const weights = Array(this.capacity + 1).fill(0) as number[];
    weights[0] = 1;
    for (let n = 1; n <= this.capacity; n++) {
      const birth = this.birthRate(n - 1);
      const death = this.deathRate(n);
      assertNonnegative(birth, `birthRate(${n - 1})`);
      assertPositive(death, `deathRate(${n})`);
      weights[n] = weights[n - 1]! * birth / death;
    }
    const total = weights.reduce((sum, value) => sum + value, 0);
    const distribution: Record<number, number> = {};
    for (let n = 0; n <= this.capacity; n++) {
      distribution[n] = weights[n]! / total;
    }
    return distribution;
  }

  stationaryProbability(state: number): number {
    assertStateWithinCapacity(state, this.capacity);
    return this.stationaryDistribution()[state]!;
  }

  blockingProbability(): number {
    return this.stationaryProbability(this.capacity);
  }

  effectiveArrivalRate(): number {
    const distribution = this.stationaryDistribution();
    let rate = 0;
    for (let n = 0; n < this.capacity; n++) {
      rate += distribution[n]! * this.birthRate(n);
    }
    return rate;
  }

  throughput(): number {
    const distribution = this.stationaryDistribution();
    let rate = 0;
    for (let n = 1; n <= this.capacity; n++) {
      rate += distribution[n]! * this.deathRate(n);
    }
    return rate;
  }

  expectedNumberInSystem(): number {
    const distribution = this.stationaryDistribution();
    let total = 0;
    for (let n = 0; n <= this.capacity; n++) {
      total += n * distribution[n]!;
    }
    return total;
  }
}

export interface MMcKQueueConfig {
  arrivalRate: number;
  serviceRate: number;
  servers: number;
  capacity: number;
}

export class MMcKQueue {
  readonly arrivalRate: number;
  readonly serviceRate: number;
  readonly servers: number;
  readonly capacity: number;
  private readonly finite: FiniteCapacityQueue;

  constructor(config: MMcKQueueConfig) {
    assertNonnegative(config.arrivalRate, "arrivalRate");
    assertPositive(config.serviceRate, "serviceRate");
    assertPositiveInteger(config.servers, "servers");
    assertNonnegativeInteger(config.capacity, "capacity");
    if (config.capacity < config.servers) {
      throw new Error("capacity must be at least servers for an M/M/c/K queue");
    }
    this.arrivalRate = config.arrivalRate;
    this.serviceRate = config.serviceRate;
    this.servers = config.servers;
    this.capacity = config.capacity;
    this.finite = new FiniteCapacityQueue({
      capacity: config.capacity,
      birthRate: (state) => state < config.capacity ? config.arrivalRate : 0,
      deathRate: (state) => Math.min(state, config.servers) * config.serviceRate,
    });
  }

  stationaryDistribution(): Record<number, number> {
    return this.finite.stationaryDistribution();
  }

  stationaryProbability(state: number): number {
    return this.finite.stationaryProbability(state);
  }

  blockingProbability(): number {
    return this.finite.blockingProbability();
  }

  effectiveArrivalRate(): number {
    return this.arrivalRate * (1 - this.blockingProbability());
  }

  throughput(): number {
    return this.finite.throughput();
  }

  utilization(): number {
    const distribution = this.stationaryDistribution();
    let busyServers = 0;
    for (let n = 0; n <= this.capacity; n++) {
      busyServers += Math.min(n, this.servers) * distribution[n]!;
    }
    return busyServers / this.servers;
  }

  expectedNumberInSystem(): number {
    return this.finite.expectedNumberInSystem();
  }

  expectedNumberInQueue(): number {
    const distribution = this.stationaryDistribution();
    let total = 0;
    for (let n = this.servers + 1; n <= this.capacity; n++) {
      total += (n - this.servers) * distribution[n]!;
    }
    return total;
  }

  expectedTimeInSystem(): number {
    const rate = this.effectiveArrivalRate();
    return rate <= DEFAULT_TOLERANCE ? 0 : this.expectedNumberInSystem() / rate;
  }

  expectedTimeInQueue(): number {
    const rate = this.effectiveArrivalRate();
    return rate <= DEFAULT_TOLERANCE ? 0 : this.expectedNumberInQueue() / rate;
  }
}

export type MultiClassQueueState<C extends string> = Record<C, number>;

export interface QueueServiceDisciplineInput<C extends string> {
  classes: readonly C[];
  priorityOrder: readonly C[];
  state: MultiClassQueueState<C>;
  servers: number;
}

export type QueueServiceDiscipline<C extends string> =
  | "priority"
  | "proportional"
  | ((input: QueueServiceDisciplineInput<C>) => Partial<Record<C, number>>);

export interface QueueAdmissionPolicyInput<C extends string> {
  classes: readonly C[];
  priorityOrder: readonly C[];
  state: MultiClassQueueState<C>;
  capacity: number;
  arrivalRates: Record<C, number>;
}

export type QueueAdmissionPolicy<C extends string> =
  | "shared-capacity"
  | { kind: "priority-reserve"; reserves: Partial<Record<C, number>> }
  | ((input: QueueAdmissionPolicyInput<C>) => Partial<Record<C, number>>);

export interface MultiClassFiniteQueueConfig<C extends string> {
  classes: readonly C[];
  priorityOrder?: readonly C[];
  arrivalRates: Record<C, number>;
  serviceRates: Record<C, number>;
  servers: number;
  capacity: number;
  serviceDiscipline?: QueueServiceDiscipline<C>;
  admissionPolicy?: QueueAdmissionPolicy<C>;
}

export interface MultiClassQueueMetrics<C extends string> {
  systemLengthByClass: Distribution<C>;
  queueLengthByClass: Distribution<C>;
  waitingTimeInQueueByClass: Distribution<C>;
  timeInSystemByClass: Distribution<C>;
  effectiveArrivalRates: Distribution<C>;
  blockingProbabilityByClass: Distribution<C>;
  utilization: number;
}

export class MultiClassFiniteQueue<C extends string> {
  readonly classes: C[];
  readonly priorityOrder: C[];
  readonly arrivalRates: Record<C, number>;
  readonly serviceRates: Record<C, number>;
  readonly servers: number;
  readonly capacity: number;
  readonly serviceDiscipline: QueueServiceDiscipline<C>;
  readonly admissionPolicy: QueueAdmissionPolicy<C>;
  readonly stateSpace: MultiClassQueueState<C>[];
  private readonly indexByKey: Map<string, number>;
  private stationaryCache: Record<string, number> | undefined;

  constructor(config: MultiClassFiniteQueueConfig<C>) {
    this.classes = uniqueValues(config.classes, "class");
    if (this.classes.length === 0) {
      throw new Error("Multi-class queue requires at least one class");
    }
    this.serviceDiscipline = config.serviceDiscipline ?? "priority";
    this.admissionPolicy = config.admissionPolicy ?? "shared-capacity";
    this.priorityOrder = uniqueValues(config.priorityOrder ?? config.classes, "priority class");
    if (this.priorityOrder.length !== this.classes.length) {
      throw new Error("priorityOrder must contain every class exactly once");
    }
    for (const cls of this.priorityOrder) {
      if (!this.classes.includes(cls)) {
        throw new Error(`Unknown priority class: ${String(cls)}`);
      }
    }
    assertPositiveInteger(config.servers, "servers");
    assertNonnegativeInteger(config.capacity, "capacity");
    this.servers = config.servers;
    this.capacity = config.capacity;
    this.arrivalRates = validateClassRates(this.classes, config.arrivalRates, false, "arrival rate");
    this.serviceRates = validateClassRates(this.classes, config.serviceRates, true, "service rate");
    validateAdmissionPolicy(this.classes, this.admissionPolicy);
    this.stateSpace = enumerateStates(this.classes, this.capacity);
    this.indexByKey = new Map(this.stateSpace.map((state, index) => [this.stateKey(state), index]));
  }

  stationaryDistribution(): Record<string, number> {
    if (this.stationaryCache) return { ...this.stationaryCache };
    const generator = this.generatorMatrix();
    const n = generator.length;
    const coefficients: Matrix = Array.from({ length: n }, (_, row) =>
      Array.from({ length: n }, (_unused, column) => generator[column]![row]!),
    );
    coefficients[n - 1] = Array(n).fill(1);
    const rhs = Array(n).fill(0) as number[];
    rhs[n - 1] = 1;
    const solution = solveLinearSystem(coefficients, rhs)
      .map((value) => Math.abs(value) < DEFAULT_TOLERANCE ? 0 : value);
    const total = solution.reduce((sum, value) => sum + value, 0);
    const distribution: Record<string, number> = {};
    for (let i = 0; i < this.stateSpace.length; i++) {
      distribution[this.stateKey(this.stateSpace[i]!)] = solution[i]! / total;
    }
    this.stationaryCache = distribution;
    return { ...distribution };
  }

  stationaryProbability(state: MultiClassQueueState<C>): number {
    const key = this.stateKey(state);
    return this.stationaryDistribution()[key]!;
  }

  generatorMatrix(): Matrix {
    const matrix: Matrix = Array.from({ length: this.stateSpace.length }, () =>
      Array(this.stateSpace.length).fill(0) as number[],
    );

    for (let fromIndex = 0; fromIndex < this.stateSpace.length; fromIndex++) {
      const state = this.stateSpace[fromIndex]!;
      let exitRate = 0;
      const admitted = this.admittedArrivalRates(state);
      for (const cls of this.classes) {
        const rate = admitted[cls]!;
        if (rate > 0) {
          const next = { ...state, [cls]: state[cls] + 1 } as MultiClassQueueState<C>;
          const toIndex = this.indexByKey.get(this.stateKey(next))!;
          matrix[fromIndex]![toIndex] = matrix[fromIndex]![toIndex]! + rate;
          exitRate += rate;
        }
      }

      const allocation = this.serviceAllocation(state);
      for (const cls of this.classes) {
        const rate = allocation[cls]! * this.serviceRates[cls];
        if (rate > 0) {
          const next = { ...state, [cls]: state[cls] - 1 } as MultiClassQueueState<C>;
          const toIndex = this.indexByKey.get(this.stateKey(next))!;
          matrix[fromIndex]![toIndex] = matrix[fromIndex]![toIndex]! + rate;
          exitRate += rate;
        }
      }

      matrix[fromIndex]![fromIndex] = -exitRate;
    }

    return matrix;
  }

  serviceAllocation(state: MultiClassQueueState<C>): Distribution<C> {
    this.assertKnownStateShape(state);
    if (this.serviceDiscipline === "proportional") {
      return this.proportionalServiceAllocation(state);
    }
    if (typeof this.serviceDiscipline === "function") {
      return this.validateServiceAllocation(
        this.serviceDiscipline({
          classes: this.classes,
          priorityOrder: this.priorityOrder,
          state: { ...state },
          servers: this.servers,
        }),
        state,
      );
    }

    let remaining = this.servers;
    const allocation = zeroByClass(this.classes);
    for (const cls of this.priorityOrder) {
      const served = Math.min(state[cls], remaining);
      allocation[cls] = served;
      remaining -= served;
    }
    return allocation;
  }

  admittedArrivalRates(state: MultiClassQueueState<C>): Distribution<C> {
    this.assertKnownStateShape(state);
    if (this.admissionPolicy === "shared-capacity") {
      return stateTotal(this.classes, state) < this.capacity
        ? { ...this.arrivalRates }
        : zeroByClass(this.classes);
    }
    if (typeof this.admissionPolicy === "function") {
      return this.validateAdmittedArrivalRates(
        this.admissionPolicy({
          classes: this.classes,
          priorityOrder: this.priorityOrder,
          state: { ...state },
          capacity: this.capacity,
          arrivalRates: { ...this.arrivalRates },
        }),
        state,
      );
    }
    return this.priorityReserveAdmissionRates(state, this.admissionPolicy.reserves);
  }

  blockingProbabilityByClass(): Distribution<C> {
    const distribution = this.stationaryDistribution();
    const result = zeroByClass(this.classes);
    for (const state of this.stateSpace) {
      const admitted = this.admittedArrivalRates(state);
      const probability = distribution[this.stateKey(state)]!;
      for (const cls of this.classes) {
        const arrivalRate = this.arrivalRates[cls];
        if (arrivalRate > DEFAULT_TOLERANCE) {
          result[cls] += probability * (1 - admitted[cls]! / arrivalRate);
        }
      }
    }
    return result;
  }

  effectiveArrivalRates(): Distribution<C> {
    const distribution = this.stationaryDistribution();
    const result = zeroByClass(this.classes);
    for (const state of this.stateSpace) {
      const admitted = this.admittedArrivalRates(state);
      const probability = distribution[this.stateKey(state)]!;
      for (const cls of this.classes) {
        result[cls] += probability * admitted[cls]!;
      }
    }
    return result;
  }

  expectedNumberInSystemByClass(): Distribution<C> {
    const distribution = this.stationaryDistribution();
    const result = zeroByClass(this.classes);
    for (const state of this.stateSpace) {
      const probability = distribution[this.stateKey(state)]!;
      for (const cls of this.classes) {
        result[cls] += state[cls] * probability;
      }
    }
    return result;
  }

  expectedNumberInQueueByClass(): Distribution<C> {
    const distribution = this.stationaryDistribution();
    const result = zeroByClass(this.classes);
    for (const state of this.stateSpace) {
      const probability = distribution[this.stateKey(state)]!;
      const allocation = this.serviceAllocation(state);
      for (const cls of this.classes) {
        result[cls] += Math.max(0, state[cls] - allocation[cls]!) * probability;
      }
    }
    return result;
  }

  expectedWaitingTimeInQueueByClass(): Distribution<C> {
    return divideClassValues(this.expectedNumberInQueueByClass(), this.effectiveArrivalRates(), this.classes);
  }

  expectedTimeInSystemByClass(): Distribution<C> {
    return divideClassValues(this.expectedNumberInSystemByClass(), this.effectiveArrivalRates(), this.classes);
  }

  utilization(): number {
    const distribution = this.stationaryDistribution();
    let busy = 0;
    for (const state of this.stateSpace) {
      const allocation = this.serviceAllocation(state);
      let busyInState = 0;
      for (const cls of this.classes) busyInState += allocation[cls]!;
      busy += busyInState * distribution[this.stateKey(state)]!;
    }
    return busy / this.servers;
  }

  metrics(): MultiClassQueueMetrics<C> {
    return {
      systemLengthByClass: this.expectedNumberInSystemByClass(),
      queueLengthByClass: this.expectedNumberInQueueByClass(),
      waitingTimeInQueueByClass: this.expectedWaitingTimeInQueueByClass(),
      timeInSystemByClass: this.expectedTimeInSystemByClass(),
      effectiveArrivalRates: this.effectiveArrivalRates(),
      blockingProbabilityByClass: this.blockingProbabilityByClass(),
      utilization: this.utilization(),
    };
  }

  stateKey(state: MultiClassQueueState<C>): string {
    this.assertKnownStateShape(state);
    return JSON.stringify(this.classes.map((cls) => state[cls]));
  }

  private assertKnownStateShape(state: MultiClassQueueState<C>) {
    let total = 0;
    for (const cls of this.classes) {
      const value = state[cls];
      if (!Number.isInteger(value) || value < 0) {
        throw new Error(`State count for ${String(cls)} must be a nonnegative integer`);
      }
      total += value;
    }
    if (total > this.capacity) {
      throw new Error("Queue state exceeds capacity");
    }
  }

  private proportionalServiceAllocation(state: MultiClassQueueState<C>): Distribution<C> {
    const total = stateTotal(this.classes, state);
    const allocation = zeroByClass(this.classes);
    if (total === 0) return allocation;
    const busyServers = Math.min(total, this.servers);
    for (const cls of this.classes) {
      allocation[cls] = busyServers * state[cls] / total;
    }
    return allocation;
  }

  private validateServiceAllocation(
    proposed: Partial<Record<C, number>>,
    state: MultiClassQueueState<C>,
  ): Distribution<C> {
    const allocation = zeroByClass(this.classes);
    let total = 0;
    for (const cls of this.classes) {
      const value = proposed[cls] ?? 0;
      assertNonnegative(value, `service allocation for ${String(cls)}`);
      if (value > state[cls] + DEFAULT_TOLERANCE) {
        throw new Error(`service allocation for ${String(cls)} exceeds queued count`);
      }
      allocation[cls] = value;
      total += value;
    }
    if (total > this.servers + DEFAULT_TOLERANCE) {
      throw new Error("service allocation exceeds server count");
    }
    return allocation;
  }

  private priorityReserveAdmissionRates(
    state: MultiClassQueueState<C>,
    reserves: Partial<Record<C, number>>,
  ): Distribution<C> {
    const total = stateTotal(this.classes, state);
    const admitted = zeroByClass(this.classes);
    if (total >= this.capacity) return admitted;

    for (const cls of this.classes) {
      const freeAfterAdmission = this.capacity - total - 1;
      let reservedNeedForOtherClasses = 0;
      for (const other of this.classes) {
        if (other === cls) continue;
        reservedNeedForOtherClasses += Math.max(0, (reserves[other] ?? 0) - state[other]);
      }
      admitted[cls] = freeAfterAdmission >= reservedNeedForOtherClasses ? this.arrivalRates[cls] : 0;
    }
    return admitted;
  }

  private validateAdmittedArrivalRates(
    proposed: Partial<Record<C, number>>,
    state: MultiClassQueueState<C>,
  ): Distribution<C> {
    const admitted = zeroByClass(this.classes);
    const isFull = stateTotal(this.classes, state) >= this.capacity;
    for (const cls of this.classes) {
      const value = proposed[cls] ?? 0;
      assertNonnegative(value, `admitted arrival rate for ${String(cls)}`);
      if (isFull && value > DEFAULT_TOLERANCE) {
        throw new Error(`admitted arrival rate for ${String(cls)} must be zero when queue is full`);
      }
      if (value > this.arrivalRates[cls] + DEFAULT_TOLERANCE) {
        throw new Error(`admitted arrival rate for ${String(cls)} exceeds arrival rate`);
      }
      admitted[cls] = value;
    }
    return admitted;
  }
}

export class PriorityQueueModel<C extends string> {
  readonly queue: MultiClassFiniteQueue<C>;

  constructor(config: MultiClassFiniteQueueConfig<C>) {
    if (!config.priorityOrder || config.priorityOrder.length === 0) {
      throw new Error("PriorityQueueModel requires a priorityOrder");
    }
    this.queue = new MultiClassFiniteQueue({ ...config, serviceDiscipline: "priority" });
  }

  static from<C extends string>(config: MultiClassFiniteQueueConfig<C>): PriorityQueueModel<C> {
    return new PriorityQueueModel(config);
  }

  stationaryDistribution(): Record<string, number> {
    return this.queue.stationaryDistribution();
  }

  metrics(): MultiClassQueueMetrics<C> {
    return this.queue.metrics();
  }

  waitingTimesByClass(): Distribution<C> {
    return this.queue.expectedWaitingTimeInQueueByClass();
  }
}

function factorial(value: number): number {
  let result = 1;
  for (let n = 2; n <= value; n++) result *= n;
  return result;
}

function assertFiniteNumber(value: number, label: string) {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be finite`);
  }
}

function assertNonnegative(value: number, label: string) {
  assertFiniteNumber(value, label);
  if (value < 0) {
    throw new Error(`${label} must be nonnegative`);
  }
}

function assertPositive(value: number, label: string) {
  assertFiniteNumber(value, label);
  if (value <= 0) {
    throw new Error(`${label} must be positive`);
  }
}

function assertNonnegativeInteger(value: number, label: string) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a nonnegative integer`);
  }
}

function assertPositiveInteger(value: number, label: string) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
}

function assertStateWithinCapacity(state: number, capacity: number) {
  assertNonnegativeInteger(state, "state");
  if (state > capacity) {
    throw new Error(`state must be at most capacity ${capacity}`);
  }
}

function validateClassRates<C extends string>(
  classes: readonly C[],
  rates: Record<C, number>,
  positive: boolean,
  label: string,
): Record<C, number> {
  const result = {} as Record<C, number>;
  for (const cls of classes) {
    const rate = rates[cls];
    if (positive) assertPositive(rate, `${label} for ${String(cls)}`);
    else assertNonnegative(rate, `${label} for ${String(cls)}`);
    result[cls] = rate;
  }
  return result;
}

function validateAdmissionPolicy<C extends string>(
  classes: readonly C[],
  policy: QueueAdmissionPolicy<C>,
) {
  if (typeof policy === "function" || policy === "shared-capacity") {
    return;
  }
  for (const cls of classes) {
    const reserve = policy.reserves[cls] ?? 0;
    assertNonnegative(reserve, `reserved capacity for ${String(cls)}`);
  }
}

function enumerateStates<C extends string>(
  classes: readonly C[],
  capacity: number,
): MultiClassQueueState<C>[] {
  const states: MultiClassQueueState<C>[] = [];
  const current = {} as MultiClassQueueState<C>;
  const visit = (index: number, remaining: number) => {
    if (index === classes.length) {
      states.push({ ...current });
      return;
    }
    const cls = classes[index]!;
    for (let count = 0; count <= remaining; count++) {
      current[cls] = count;
      visit(index + 1, remaining - count);
    }
  };
  visit(0, capacity);
  return states;
}

function stateTotal<C extends string>(classes: readonly C[], state: MultiClassQueueState<C>): number {
  return classes.reduce((sum, cls) => sum + state[cls], 0);
}

function zeroByClass<C extends string>(classes: readonly C[]): Distribution<C> {
  const result = {} as Distribution<C>;
  for (const cls of classes) result[cls] = 0;
  return result;
}

function divideClassValues<C extends string>(
  numerator: Distribution<C>,
  denominator: Distribution<C>,
  classes: readonly C[],
): Distribution<C> {
  const result = zeroByClass(classes);
  for (const cls of classes) {
    result[cls] = denominator[cls]! <= DEFAULT_TOLERANCE ? 0 : numerator[cls]! / denominator[cls]!;
  }
  return result;
}
