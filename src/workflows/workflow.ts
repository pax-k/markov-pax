import { AbsorbingChain } from "../chains/absorbing-chain.ts";
import { type Distribution, SeededRng, vectorToDistribution } from "../shared/core.ts";
import { CTMC } from "../chains/ctmc.ts";
import { BayesianNetwork } from "../models/graphical-models.ts";
import { HiddenMarkovModel } from "../models/hmm.ts";
import { MarkovChain } from "../chains/markov-chain.ts";
import { metropolisHastings } from "../models/mcmc.ts";
import { MDP, POMDP } from "../models/mdp.ts";
import { SemiMarkovProcess } from "../chains/semi-markov.ts";

export interface WorkflowSetup<S extends string = string, A extends string = string, O extends string = string> {
  name?: string;
  states?: readonly S[];
  actions?: readonly A[];
  observations?: readonly O[];
}

export interface WorkflowResult {
  belief?: Distribution<string>;
  inferredState?: string;
  forecast?: unknown;
  recommendedAction?: string;
  actionValues?: Distribution<string>;
  simulatedPath?: unknown[];
  uncertainty?: Record<string, WorkflowUncertaintySummary>;
  details: Record<string, unknown>;
}

export interface WorkflowUncertaintySummary {
  samples: number[];
  mean: number;
  variance: number;
  acceptanceRate: number;
}

export type WorkflowInferenceStage =
  | { kind: "hmm"; model: HiddenMarkovModel<string, string>; observations?: readonly string[] }
  | {
    kind: "pomdp";
    model: POMDP<string, string, string>;
    belief?: Partial<Distribution<string>>;
    action?: string;
    observation?: string;
  }
  | {
    kind: "bayesianNetwork";
    model: BayesianNetwork<string>;
    variable?: string;
    evidence?: Partial<Record<string, string>>;
  };

export type WorkflowForecastStage =
  | {
    kind: "markov";
    model: MarkovChain<string>;
    distribution?: Partial<Distribution<string>>;
    steps?: number;
    normalize?: boolean;
  }
  | { kind: "ctmc"; model: CTMC<string>; time?: number; start?: string }
  | { kind: "absorbing"; model: AbsorbingChain<string>; from?: string }
  | { kind: "semiMarkov"; model: SemiMarkovProcess<string>; start?: string; horizon?: number; seed?: number };

export type WorkflowDecisionStage = {
  model: MDP<string, string>;
  state?: string;
  tolerance?: number;
  maxIterations?: number;
};

export type WorkflowSimulationStage =
  | { kind: "markov"; model: MarkovChain<string>; start?: string; steps?: number; seed?: number }
  | { kind: "ctmc"; model: CTMC<string>; start?: string; horizon?: number; seed?: number }
  | { kind: "mdp"; model: MDP<string, string>; start?: string; steps?: number; policy?: Record<string, string>; seed?: number }
  | { kind: "semiMarkov"; model: SemiMarkovProcess<string>; start?: string; horizon?: number; seed?: number };

export interface WorkflowUncertaintyStage {
  parameter: string;
  initial: number;
  logTarget: (value: number) => number;
  proposalStandardDeviation?: number;
  iterations?: number;
  burnIn?: number;
  seed?: number;
}

export interface WorkflowRunInput {
  observations?: readonly string[];
  belief?: Partial<Distribution<string>>;
  action?: string;
  observation?: string;
  variable?: string;
  evidence?: Partial<Record<string, string>>;
  distribution?: Partial<Distribution<string>>;
  steps?: number;
  time?: number;
  start?: string;
  from?: string;
  horizon?: number;
  policy?: Record<string, string>;
  seed?: number;
}

export class MarkovWorkflow {
  readonly setup: WorkflowSetup;
  private inference?: WorkflowInferenceStage;
  private forecastStage?: WorkflowForecastStage;
  private decision?: WorkflowDecisionStage;
  private simulation?: WorkflowSimulationStage;
  private uncertaintyStages: WorkflowUncertaintyStage[] = [];

  constructor(setup: WorkflowSetup = {}) {
    this.setup = setup;
  }

  static create(setup: WorkflowSetup = {}): MarkovWorkflow {
    return new MarkovWorkflow(setup);
  }

  withInference(stage: WorkflowInferenceStage): MarkovWorkflow {
    this.inference = stage;
    return this;
  }

  withForecast(stage: WorkflowForecastStage): MarkovWorkflow {
    this.forecastStage = stage;
    return this;
  }

  withDecision(stage: WorkflowDecisionStage): MarkovWorkflow {
    this.decision = stage;
    return this;
  }

  withSimulation(stage: WorkflowSimulationStage): MarkovWorkflow {
    this.simulation = stage;
    return this;
  }

  withUncertainty(stage: WorkflowUncertaintyStage): MarkovWorkflow {
    this.uncertaintyStages.push(stage);
    return this;
  }

  run(input: WorkflowRunInput = {}): WorkflowResult {
    if (!this.inference && !this.forecastStage && !this.decision && !this.simulation && this.uncertaintyStages.length === 0) {
      throw new Error("Workflow must configure at least one stage");
    }

    const result: WorkflowResult = { details: {} };
    if (this.inference) applyInference(this.inference, input, result);
    if (this.forecastStage) applyForecast(this.forecastStage, input, result);
    if (this.decision) applyDecision(this.decision, input, result);
    if (this.simulation) applySimulation(this.simulation, input, result);
    if (this.uncertaintyStages.length > 0) applyUncertainty(this.uncertaintyStages, result);
    return result;
  }
}

export function createWorkflow(setup: WorkflowSetup = {}): MarkovWorkflow {
  return MarkovWorkflow.create(setup);
}

export function mostLikely(distribution: Distribution<string>): string {
  return Object.entries(distribution).reduce((best, current) => current[1] > best[1] ? current : best)[0];
}

function applyInference(stage: WorkflowInferenceStage, input: WorkflowRunInput, result: WorkflowResult) {
  if (stage.kind === "hmm") {
    const observations = [...must(input.observations ?? stage.observations, "HMM inference requires observations")];
    const forward = stage.model.forward(observations);
    const viterbi = stage.model.viterbi(observations);
    result.belief = forward.posterior;
    result.inferredState = viterbi.path.at(-1);
    result.details.inference = { kind: stage.kind, forward, viterbi };
  }

  if (stage.kind === "pomdp") {
    const belief = must(input.belief ?? stage.belief, "POMDP inference requires a prior belief");
    const action = must(input.action ?? stage.action, "POMDP inference requires an action");
    const observation = must(input.observation ?? stage.observation, "POMDP inference requires an observation");
    const posterior = stage.model.updateBelief({ belief, action, observation });
    result.belief = posterior;
    result.inferredState = mostLikely(posterior);
    result.details.inference = { kind: stage.kind, posterior };
  }

  if (stage.kind === "bayesianNetwork") {
    const variable = must(input.variable ?? stage.variable, "Bayesian network inference requires a query variable");
    const evidence = input.evidence ?? stage.evidence ?? {};
    const posterior = stage.model.query(variable, evidence);
    result.belief = posterior;
    result.inferredState = mostLikely(posterior);
    result.details.inference = { kind: stage.kind, posterior };
  }
}

function applyForecast(stage: WorkflowForecastStage, input: WorkflowRunInput, result: WorkflowResult) {
  if (stage.kind === "markov") {
    const distribution = must(input.distribution ?? stage.distribution, "Markov forecast requires a starting distribution");
    const steps = must(input.steps ?? stage.steps, "Markov forecast requires a step count");
    const forecast = stage.model.distributionAfter(distribution, steps, { normalize: stage.normalize });
    result.forecast = forecast;
    result.details.forecast = { kind: stage.kind, steps, distribution: forecast };
  }

  if (stage.kind === "ctmc") {
    const time = must(input.time ?? stage.time, "CTMC forecast requires a time horizon");
    const transitionMatrix = stage.model.transitionMatrix(time);
    const start = input.start ?? stage.start;
    const forecast = start ? ctmcRowDistribution(stage.model, transitionMatrix, start) : stage.model.stationary();
    result.forecast = forecast;
    result.details.forecast = { kind: stage.kind, time, transitionMatrix };
  }

  if (stage.kind === "absorbing") {
    const absorption = stage.model.absorptionProbabilities();
    const from = input.from ?? stage.from;
    result.forecast = from ? absorption[from] : absorption;
    result.details.forecast = {
      kind: stage.kind,
      absorptionProbabilities: absorption,
      expectedTimeToAbsorption: stage.model.expectedTimeToAbsorption(),
    };
  }

  if (stage.kind === "semiMarkov") {
    const start = must(input.start ?? stage.start, "Semi-Markov forecast requires a start state");
    const horizon = must(input.horizon ?? stage.horizon, "Semi-Markov forecast requires a time horizon");
    const events = stage.model.simulateUntil(horizon, start, { rng: rng(input.seed ?? stage.seed) });
    const occupancy = stage.model.occupancyTimes(events);
    result.forecast = occupancy;
    result.details.forecast = { kind: stage.kind, events, occupancy };
  }
}

function applyDecision(stage: WorkflowDecisionStage, input: WorkflowRunInput, result: WorkflowResult) {
  const state = must(input.start ?? stage.state, "Decision stage requires a current state");
  const solved = stage.model.valueIteration({ tolerance: stage.tolerance, maxIterations: stage.maxIterations });
  result.recommendedAction = solved.policy[state];
  result.actionValues = actionValues(stage.model, state, solved.values);
  result.details.decision = solved;
}

function applySimulation(stage: WorkflowSimulationStage, input: WorkflowRunInput, result: WorkflowResult) {
  if (stage.kind === "markov") {
    const start = must(input.start ?? stage.start, "Markov simulation requires a start state");
    const steps = must(input.steps ?? stage.steps, "Markov simulation requires a step count");
    result.simulatedPath = stage.model.simulate(start, steps, { rng: rng(input.seed ?? stage.seed) });
  }

  if (stage.kind === "ctmc") {
    const start = must(input.start ?? stage.start, "CTMC simulation requires a start state");
    const horizon = must(input.horizon ?? stage.horizon, "CTMC simulation requires a time horizon");
    result.simulatedPath = stage.model.simulate(start, horizon, { rng: rng(input.seed ?? stage.seed) });
  }

  if (stage.kind === "mdp") {
    const start = must(input.start ?? stage.start, "MDP simulation requires a start state");
    const steps = must(input.steps ?? stage.steps, "MDP simulation requires a step count");
    const policy = must(input.policy ?? stage.policy, "MDP simulation requires a policy");
    result.simulatedPath = stage.model.simulate(start, policy, steps, { rng: rng(input.seed ?? stage.seed) });
  }

  if (stage.kind === "semiMarkov") {
    const start = must(input.start ?? stage.start, "Semi-Markov simulation requires a start state");
    const horizon = must(input.horizon ?? stage.horizon, "Semi-Markov simulation requires a time horizon");
    result.simulatedPath = stage.model.simulateUntil(horizon, start, { rng: rng(input.seed ?? stage.seed) });
  }

  result.details.simulation = result.simulatedPath;
}

function applyUncertainty(stages: readonly WorkflowUncertaintyStage[], result: WorkflowResult) {
  result.uncertainty = {};
  for (const stage of stages) {
    const iterations = stage.iterations ?? 1_000;
    const burnIn = stage.burnIn ?? Math.floor(iterations / 5);
    const sd = stage.proposalStandardDeviation ?? 0.1;
    if (!Number.isFinite(sd) || sd <= 0) {
      throw new Error("proposalStandardDeviation must be positive");
    }
    const sampler = metropolisHastings({
      initial: stage.initial,
      logTarget: stage.logTarget,
      proposal: (current, generator) => current + generator.normal(0, sd),
      rng: rng(stage.seed),
    });
    const sampled = sampler.run({ iterations, burnIn });
    result.uncertainty[stage.parameter] = {
      samples: sampled.samples,
      mean: sampled.mean(),
      variance: sampled.variance(),
      acceptanceRate: sampled.acceptanceRate,
    };
  }
  result.details.uncertainty = result.uncertainty;
}

function actionValues(model: MDP<string, string>, state: string, values: Distribution<string>): Distribution<string> {
  const vector = model.states.map((candidate) => values[candidate]);
  const result: Distribution<string> = {};
  for (const action of model.actions) {
    let future = 0;
    for (let i = 0; i < model.states.length; i++) {
      future += model.transition[state]![action]![i]! * vector[i]!;
    }
    result[action] = model.reward[state]![action]! + model.discount * future;
  }
  return result;
}

function ctmcRowDistribution(model: CTMC<string>, matrix: number[][], start: string): Distribution<string> {
  const index = model.states.indexOf(start);
  if (index < 0) {
    throw new Error(`Unknown state: ${String(start)}`);
  }
  return vectorToDistribution(model.states, matrix[index]!);
}

function rng(seed: number | undefined) {
  return seed === undefined ? undefined : new SeededRng(seed);
}

function must<T>(value: T | undefined, message: string): T {
  if (value === undefined) {
    throw new Error(message);
  }
  return value;
}
