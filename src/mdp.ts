import {
  DEFAULT_MAX_ITERATIONS,
  DEFAULT_TOLERANCE,
  type Distribution,
  type Rng,
  distributionToVector,
  identity,
  sampleIndex,
  solveLinearSystem,
  uniqueValues,
  vectorDistance,
  vectorToDistribution,
} from "./core.ts";

export interface MDPConfig<S extends string, A extends string> {
  states: readonly S[];
  actions: readonly A[];
  discount: number;
  transition: Record<S, Record<A, Partial<Record<S, number>>>>;
  reward: Record<S, Record<A, number>>;
}

export interface ValueIterationResult<S extends string, A extends string> {
  values: Record<S, number>;
  policy: Record<S, A>;
  iterations: number;
  delta: number;
}

export interface MDPStep<S extends string, A extends string> {
  state: S;
  action: A;
  reward: number;
  nextState: S;
}

export class MDP<S extends string, A extends string> {
  readonly states: S[];
  readonly actions: A[];
  readonly discount: number;
  readonly transition: Record<S, Record<A, number[]>>;
  readonly reward: Record<S, Record<A, number>>;
  private readonly stateIndex: Map<S, number>;

  constructor(config: MDPConfig<S, A>) {
    this.states = uniqueValues(config.states, "state");
    this.actions = uniqueValues(config.actions, "action");
    if (!Number.isFinite(config.discount) || config.discount < 0 || config.discount >= 1) {
      throw new Error("Discount must be finite and in [0, 1)");
    }

    this.discount = config.discount;
    this.stateIndex = new Map(this.states.map((state, index) => [state, index]));

    const transition: Partial<Record<S, Record<A, number[]>>> = {};
    const reward: Partial<Record<S, Record<A, number>>> = {};

    for (const state of this.states) {
      const stateTransition = {} as Record<A, number[]>;
      const stateReward = {} as Record<A, number>;
      for (const action of this.actions) {
        const row = config.transition[state]?.[action];
        if (!row) {
          throw new Error(`Missing transition for ${String(state)} / ${String(action)}`);
        }
        stateTransition[action] = distributionToVector(this.states, row);

        const value = config.reward[state]?.[action];
        if (!Number.isFinite(value)) {
          throw new Error(`Missing or invalid reward for ${String(state)} / ${String(action)}`);
        }
        stateReward[action] = value;
      }
      transition[state] = stateTransition;
      reward[state] = stateReward;
    }

    this.transition = transition as Record<S, Record<A, number[]>>;
    this.reward = reward as Record<S, Record<A, number>>;
  }

  static from<S extends string, A extends string>(config: MDPConfig<S, A>): MDP<S, A> {
    return new MDP(config);
  }

  evaluatePolicy(policy: Record<S, A>): Record<S, number> {
    const n = this.states.length;
    const coefficients = identity(n);
    const rhs = Array(n).fill(0) as number[];

    for (let i = 0; i < n; i++) {
      const state = this.states[i]!;
      const action = policy[state];
      this.ensureAction(action);
      rhs[i] = this.reward[state][action];
      const row = this.transition[state][action];
      for (let j = 0; j < n; j++) {
        coefficients[i]![j] = coefficients[i]![j]! - this.discount * row[j]!;
      }
    }

    return vectorToDistribution(this.states, solveLinearSystem(coefficients, rhs));
  }

  valueIteration(options: {
    tolerance?: number;
    maxIterations?: number;
  } = {}): ValueIterationResult<S, A> {
    const tolerance = options.tolerance ?? DEFAULT_TOLERANCE;
    const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;
    let values = Array(this.states.length).fill(0) as number[];
    let policy = this.initialPolicy();
    let delta = Infinity;

    for (let iteration = 1; iteration <= maxIterations; iteration++) {
      const next = Array(this.states.length).fill(0) as number[];

      for (let i = 0; i < this.states.length; i++) {
        const state = this.states[i]!;
        let bestValue = Number.NEGATIVE_INFINITY;
        let bestAction = this.actions[0]!;

        for (const action of this.actions) {
          const candidate = this.qValue(state, action, values);
          if (candidate > bestValue) {
            bestValue = candidate;
            bestAction = action;
          }
        }

        next[i] = bestValue;
        policy[state] = bestAction;
      }

      delta = vectorDistance(values, next);
      values = next;
      if (delta <= tolerance) {
        return {
          values: vectorToDistribution(this.states, values),
          policy,
          iterations: iteration,
          delta,
        };
      }
    }

    throw new Error(`Value iteration did not converge in ${maxIterations} iterations`);
  }

  policyIteration(options: { maxIterations?: number } = {}): ValueIterationResult<S, A> {
    const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;
    let policy = this.initialPolicy();
    let values = this.evaluatePolicy(policy);

    for (let iteration = 1; iteration <= maxIterations; iteration++) {
      let stable = true;
      const valueVector = this.states.map((state) => values[state]);

      for (const state of this.states) {
        const oldAction = policy[state];
        let bestAction = oldAction;
        let bestValue = Number.NEGATIVE_INFINITY;

        for (const action of this.actions) {
          const candidate = this.qValue(state, action, valueVector);
          if (candidate > bestValue) {
            bestValue = candidate;
            bestAction = action;
          }
        }

        policy[state] = bestAction;
        if (bestAction !== oldAction) stable = false;
      }

      values = this.evaluatePolicy(policy);
      if (stable) {
        return {
          values,
          policy,
          iterations: iteration,
          delta: 0,
        };
      }
    }

    throw new Error(`Policy iteration did not converge in ${maxIterations} iterations`);
  }

  simulate(start: S, policy: Record<S, A>, steps: number, options: { rng?: Rng } = {}): MDPStep<S, A>[] {
    this.indexOf(start);
    if (!Number.isInteger(steps) || steps < 0) {
      throw new Error(`Steps must be a nonnegative integer; received ${steps}`);
    }

    const events: MDPStep<S, A>[] = [];
    let state = start;
    for (let step = 0; step < steps; step++) {
      const action = policy[state];
      this.ensureAction(action);
      const nextIndex = sampleIndex(this.transition[state][action], options.rng);
      const nextState = this.states[nextIndex]!;
      events.push({
        state,
        action,
        reward: this.reward[state][action],
        nextState,
      });
      state = nextState;
    }
    return events;
  }

  private qValue(state: S, action: A, values: readonly number[]): number {
    const transitions = this.transition[state][action];
    let future = 0;
    for (let i = 0; i < transitions.length; i++) {
      future += transitions[i]! * values[i]!;
    }
    return this.reward[state][action] + this.discount * future;
  }

  private initialPolicy(): Record<S, A> {
    const result: Partial<Record<S, A>> = {};
    for (const state of this.states) {
      result[state] = this.actions[0]!;
    }
    return result as Record<S, A>;
  }

  private ensureAction(action: A | undefined) {
    if (action === undefined || !this.actions.includes(action)) {
      throw new Error(`Unknown action: ${String(action)}`);
    }
  }

  private indexOf(state: S): number {
    const index = this.stateIndex.get(state);
    if (index === undefined) {
      throw new Error(`Unknown state: ${String(state)}`);
    }
    return index;
  }
}

export interface POMDPConfig<S extends string, A extends string, O extends string> {
  states: readonly S[];
  actions: readonly A[];
  observations: readonly O[];
  transition: Record<S, Record<A, Partial<Record<S, number>>>>;
  observation: Record<S, Record<A, Partial<Record<O, number>>>>;
}

export class POMDP<S extends string, A extends string, O extends string> {
  readonly states: S[];
  readonly actions: A[];
  readonly observations: O[];
  readonly transition: Record<S, Record<A, number[]>>;
  readonly observation: Record<S, Record<A, number[]>>;

  constructor(config: POMDPConfig<S, A, O>) {
    this.states = uniqueValues(config.states, "state");
    this.actions = uniqueValues(config.actions, "action");
    this.observations = uniqueValues(config.observations, "observation");

    const transition: Partial<Record<S, Record<A, number[]>>> = {};
    const observation: Partial<Record<S, Record<A, number[]>>> = {};
    for (const state of this.states) {
      const stateTransition = {} as Record<A, number[]>;
      const stateObservation = {} as Record<A, number[]>;
      for (const action of this.actions) {
        stateTransition[action] = distributionToVector(this.states, config.transition[state]?.[action] ?? {});
        stateObservation[action] = distributionToVector(this.observations, config.observation[state]?.[action] ?? {});
      }
      transition[state] = stateTransition;
      observation[state] = stateObservation;
    }

    this.transition = transition as Record<S, Record<A, number[]>>;
    this.observation = observation as Record<S, Record<A, number[]>>;
  }

  static from<S extends string, A extends string, O extends string>(
    config: POMDPConfig<S, A, O>,
  ): POMDP<S, A, O> {
    return new POMDP(config);
  }

  updateBelief(input: {
    belief: Partial<Distribution<S>>;
    action: A;
    observation: O;
  }): Distribution<S> {
    if (!this.actions.includes(input.action)) {
      throw new Error(`Unknown action: ${String(input.action)}`);
    }
    const observationIndex = this.observations.indexOf(input.observation);
    if (observationIndex < 0) {
      throw new Error(`Unknown observation: ${String(input.observation)}`);
    }

    const belief = distributionToVector(this.states, input.belief);
    const predicted = Array(this.states.length).fill(0) as number[];

    for (let from = 0; from < this.states.length; from++) {
      const state = this.states[from]!;
      const row = this.transition[state][input.action];
      for (let to = 0; to < this.states.length; to++) {
        predicted[to] = predicted[to]! + belief[from]! * row[to]!;
      }
    }

    const posterior = predicted.map((probability, stateIndex) => {
      const state = this.states[stateIndex]!;
      return probability * this.observation[state][input.action][observationIndex]!;
    });

    const total = posterior.reduce((acc, value) => acc + value, 0);
    if (total <= 0) {
      throw new Error("Belief update has zero probability");
    }

    return vectorToDistribution(this.states, posterior.map((value) => value / total));
  }
}
