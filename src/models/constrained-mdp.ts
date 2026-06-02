import { MDP, type MDPConfig, type ValueIterationResult } from "./mdp.ts";

export interface ConstrainedPolicyEvaluation<S extends string, A extends string> {
  policy: Record<S, A>;
  rewardValues: Record<S, number>;
  costValues: Record<S, number>;
  feasible: boolean;
}

export class ConstrainedMDP<S extends string, A extends string> {
  readonly mdp: MDP<S, A>;
  readonly costs: Record<S, Record<A, number>>;
  readonly budget: number;
  readonly maxPolicies: number;

  constructor(config: {
    mdp: MDP<S, A> | MDPConfig<S, A>;
    costs: Record<S, Record<A, number>>;
    budget: number;
    maxPolicies?: number;
  }) {
    this.mdp = config.mdp instanceof MDP ? config.mdp : MDP.from(config.mdp);
    this.costs = validateCostTable(this.mdp.states, this.mdp.actions, config.costs);
    if (!Number.isFinite(config.budget) || config.budget < 0) throw new Error("budget must be nonnegative");
    this.budget = config.budget;
    this.maxPolicies = config.maxPolicies ?? 100_000;
    if (!Number.isInteger(this.maxPolicies) || this.maxPolicies <= 0) throw new Error("maxPolicies must be positive");
  }

  evaluatePolicy(policy: Record<S, A>): ConstrainedPolicyEvaluation<S, A> {
    const rewardValues = this.mdp.evaluatePolicy(policy);
    const costValues = MDP.from({
      states: this.mdp.states,
      actions: this.mdp.actions,
      discount: this.mdp.discount,
      transition: transitionObject(this.mdp),
      reward: this.costs,
    }).evaluatePolicy(policy);
    return {
      policy: { ...policy },
      rewardValues,
      costValues,
      feasible: Math.max(...this.mdp.states.map((state) => costValues[state])) <= this.budget,
    };
  }

  solve(options: { start?: S } = {}) {
    const policies = enumeratePolicies(this.mdp.states, this.mdp.actions, this.maxPolicies);
    let best: ConstrainedPolicyEvaluation<S, A> | undefined;
    for (const policy of policies) {
      const evaluation = this.evaluatePolicy(policy);
      if (!evaluation.feasible) continue;
      const value = options.start ? evaluation.rewardValues[options.start] : average(this.mdp.states.map((state) => evaluation.rewardValues[state]));
      let bestValue = Number.NEGATIVE_INFINITY;
      if (best) {
        const currentBest = best;
        bestValue = options.start
          ? currentBest.rewardValues[options.start]
          : average(this.mdp.states.map((state) => currentBest.rewardValues[state]));
      }
      if (value > bestValue) best = evaluation;
    }
    if (!best) throw new Error("No feasible policy satisfies the budget");
    return best;
  }
}

export class MultiObjectiveMDP<S extends string, A extends string, O extends string> {
  readonly mdp: MDP<S, A>;
  readonly objectives: Record<O, Record<S, Record<A, number>>>;
  readonly weights: Record<O, number>;

  constructor(config: {
    states: readonly S[];
    actions: readonly A[];
    discount: number;
    transition: MDPConfig<S, A>["transition"];
    objectives: Record<O, Record<S, Record<A, number>>>;
    weights: Record<O, number>;
  }) {
    const objectiveNames = Object.keys(config.objectives) as O[];
    if (objectiveNames.length === 0) throw new Error("MultiObjectiveMDP requires at least one objective");
    this.objectives = config.objectives;
    this.weights = validateWeights(objectiveNames, config.weights);
    const reward = {} as Record<S, Record<A, number>>;
    for (const state of config.states) {
      reward[state] = {} as Record<A, number>;
      for (const action of config.actions) {
        let value = 0;
        for (const objective of objectiveNames) {
          const objectiveValue = config.objectives[objective]?.[state]?.[action];
          if (!Number.isFinite(objectiveValue)) {
            throw new Error(`Missing objective value for ${String(objective)} / ${String(state)} / ${String(action)}`);
          }
          value += this.weights[objective] * objectiveValue;
        }
        reward[state][action] = value;
      }
    }
    this.mdp = MDP.from({
      states: config.states,
      actions: config.actions,
      discount: config.discount,
      transition: config.transition,
      reward,
    });
  }

  solve(options: { tolerance?: number; maxIterations?: number } = {}): ValueIterationResult<S, A> {
    return this.mdp.valueIteration(options);
  }
}

function enumeratePolicies<S extends string, A extends string>(
  states: readonly S[],
  actions: readonly A[],
  maxPolicies: number,
): Record<S, A>[] {
  const total = actions.length ** states.length;
  if (total > maxPolicies) throw new Error(`Policy space ${total} exceeds maxPolicies ${maxPolicies}`);
  const result: Record<S, A>[] = [];
  const current = {} as Record<S, A>;
  const visit = (index: number) => {
    if (index === states.length) {
      result.push({ ...current });
      return;
    }
    const state = states[index]!;
    for (const action of actions) {
      current[state] = action;
      visit(index + 1);
    }
  };
  visit(0);
  return result;
}

function transitionObject<S extends string, A extends string>(mdp: MDP<S, A>): MDPConfig<S, A>["transition"] {
  const transition = {} as MDPConfig<S, A>["transition"];
  for (const state of mdp.states) {
    transition[state] = {} as Record<A, Partial<Record<S, number>>>;
    for (const action of mdp.actions) {
      const row = {} as Partial<Record<S, number>>;
      for (let index = 0; index < mdp.states.length; index++) row[mdp.states[index]!] = mdp.transition[state][action][index]!;
      transition[state][action] = row;
    }
  }
  return transition;
}

function validateCostTable<S extends string, A extends string>(
  states: readonly S[],
  actions: readonly A[],
  costs: Record<S, Record<A, number>>,
): Record<S, Record<A, number>> {
  const result = {} as Record<S, Record<A, number>>;
  for (const state of states) {
    result[state] = {} as Record<A, number>;
    for (const action of actions) {
      const value = costs[state]?.[action];
      if (!Number.isFinite(value) || value < 0) throw new Error(`cost for ${String(state)} / ${String(action)} must be nonnegative`);
      result[state][action] = value;
    }
  }
  return result;
}

function validateWeights<O extends string>(objectives: readonly O[], weights: Record<O, number>): Record<O, number> {
  const result = {} as Record<O, number>;
  let total = 0;
  for (const objective of objectives) {
    const weight = weights[objective];
    if (!Number.isFinite(weight)) throw new Error(`weight for ${String(objective)} must be finite`);
    result[objective] = weight;
    total += Math.abs(weight);
  }
  if (total === 0) throw new Error("At least one objective weight must be nonzero");
  return result;
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
