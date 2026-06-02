import { type Distribution, type WeightedTransitions } from "../shared/core.ts";
import { MarkovChain } from "../chains/markov-chain.ts";
import { POMDP, type POMDPConfig } from "../models/mdp.ts";
import {
  QueueResourceOptimizer,
  type QueueResourceCandidate,
  type QueueResourceEvaluation,
  type QueueResourceOptimizerConfig,
} from "../models/queue-resource-optimizer.ts";
import {
  createWorkflow,
  type WorkflowResult,
  type WorkflowRunInput,
  type WorkflowUncertaintyStage,
} from "./workflow.ts";

export interface EmergencyDepartmentPressureInferenceConfig {
  model: POMDPConfig<string, string, string>;
  belief: Partial<Distribution<string>>;
  action: string;
  observation?: string;
}

export interface EmergencyDepartmentForecastConfig {
  transitions: WeightedTransitions<string>;
  distribution: Partial<Distribution<string>>;
  steps: number;
}

export interface EmergencyDepartmentCapacityWorkflowConfig<C extends string = string, A extends string = string> {
  acuityClasses: readonly C[];
  priorityOrder: readonly C[];
  arrivalRates: Record<C, number>;
  serviceRates: Record<C, number>;
  candidateActions: readonly QueueResourceCandidate<A>[];
  waitingCosts: Record<C, number>;
  rejectionCosts: Record<C, number>;
  serverCost: number;
  capacityCost: number;
  pressureInference?: EmergencyDepartmentPressureInferenceConfig;
  forecast?: EmergencyDepartmentForecastConfig;
  uncertainty?: WorkflowUncertaintyStage;
}

export interface EmergencyDepartmentCapacityInput<C extends string = string> extends WorkflowRunInput {
  currentQueueCounts?: Partial<Record<C, number>>;
  bedOccupancy?: { occupied: number; capacity: number };
  surgeMultiplier?: number;
  pressureBelief?: Partial<Distribution<string>>;
  pressureAction?: string;
  pressureObservation?: string;
  forecastDistribution?: Partial<Distribution<string>>;
  forecastSteps?: number;
}

export function emergencyDepartmentCapacityWorkflow<C extends string, A extends string>(
  config: EmergencyDepartmentCapacityWorkflowConfig<C, A>,
) {
  const optimizer = new QueueResourceOptimizer<C, A>({
    classes: config.acuityClasses,
    priorityOrder: config.priorityOrder,
    arrivalRates: config.arrivalRates,
    serviceRates: config.serviceRates,
    candidates: config.candidateActions,
    waitingCosts: config.waitingCosts,
    rejectionCosts: config.rejectionCosts,
    serverCost: config.serverCost,
    capacityCost: config.capacityCost,
  });

  return {
    plan(input: EmergencyDepartmentCapacityInput<C> = {}): WorkflowResult {
      const result = runOptionalWorkflow(config, input);
      const optimization = optimizer.evaluate({ arrivalRateScale: input.surgeMultiplier ?? 1 });
      const best = optimization.best;
      const currentQueueCounts = normalizeCounts(config.acuityClasses, input.currentQueueCounts ?? {});

      result.recommendedAction = best.action;
      result.actionValues = optimization.actionValues as Record<string, number>;
      result.forecast ??= {
        waitingTimeByAcuity: best.metrics.waitingTimeInQueueByClass,
        queueLengthByAcuity: best.metrics.queueLengthByClass,
        blockingProbability: best.metrics.blockingProbabilityByClass,
        serverUtilization: best.metrics.utilization,
      };

      result.details.queueMetricsByAction = metricsByAction(optimization.evaluations);
      result.details.bestPlan = best;
      result.details.waitingTimeByAcuity = best.metrics.waitingTimeInQueueByClass;
      result.details.queueLengthByAcuity = best.metrics.queueLengthByClass;
      result.details.blockingProbability = best.metrics.blockingProbabilityByClass;
      result.details.serverUtilization = best.metrics.utilization;
      result.details.bedOccupancy = bedOccupancyDetails(input, best, currentQueueCounts);
      result.details.currentQueueCounts = currentQueueCounts;
      return result;
    },
  };
}

function runOptionalWorkflow<C extends string, A extends string>(
  config: EmergencyDepartmentCapacityWorkflowConfig<C, A>,
  input: EmergencyDepartmentCapacityInput<C>,
): WorkflowResult {
  const workflow = createWorkflow({ name: "emergency department capacity" });
  let hasStage = false;

  if (config.pressureInference) {
    workflow.withInference({
      kind: "pomdp",
      model: POMDP.from(config.pressureInference.model),
      belief: input.pressureBelief ?? config.pressureInference.belief,
      action: input.pressureAction ?? config.pressureInference.action,
      observation: input.pressureObservation ?? config.pressureInference.observation,
    });
    hasStage = true;
  }

  if (config.forecast) {
    workflow.withForecast({
      kind: "markov",
      model: MarkovChain.from(config.forecast.transitions),
      distribution: input.forecastDistribution ?? config.forecast.distribution,
      steps: input.forecastSteps ?? config.forecast.steps,
    });
    hasStage = true;
  }

  if (config.uncertainty) {
    workflow.withUncertainty(config.uncertainty);
    hasStage = true;
  }

  return hasStage ? workflow.run(input) : { details: {} };
}

function metricsByAction<C extends string, A extends string>(
  evaluations: Record<A, QueueResourceEvaluation<C, A>>,
): Record<A, QueueResourceEvaluation<C, A>["metrics"]> {
  const result = {} as Record<A, QueueResourceEvaluation<C, A>["metrics"]>;
  for (const [action, evaluation] of Object.entries(evaluations) as [A, QueueResourceEvaluation<C, A>][]) {
    result[action] = evaluation.metrics;
  }
  return result;
}

function bedOccupancyDetails<C extends string, A extends string>(
  input: EmergencyDepartmentCapacityInput<C>,
  best: QueueResourceEvaluation<C, A>,
  currentQueueCounts: Record<C, number>,
) {
  const occupied = input.bedOccupancy?.occupied ?? sumCounts(currentQueueCounts);
  const capacity = input.bedOccupancy?.capacity ?? best.candidate.capacity;
  assertNonnegative(occupied, "bedOccupancy.occupied");
  assertPositive(capacity, "bedOccupancy.capacity");
  return {
    occupied,
    capacity,
    occupancyRate: occupied / capacity,
  };
}

function normalizeCounts<C extends string>(
  classes: readonly C[],
  counts: Partial<Record<C, number>>,
): Record<C, number> {
  const result = {} as Record<C, number>;
  for (const cls of classes) {
    const value = counts[cls] ?? 0;
    assertNonnegative(value, `currentQueueCounts.${String(cls)}`);
    result[cls] = value;
  }
  return result;
}

function sumCounts<C extends string>(counts: Partial<Record<C, number>>): number {
  let total = 0;
  for (const value of Object.values(counts) as number[]) {
    total += value;
  }
  return total;
}

function assertNonnegative(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be nonnegative`);
  }
}

function assertPositive(value: number, label: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be positive`);
  }
}
