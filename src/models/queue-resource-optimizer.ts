import { type Distribution } from "../shared/core.ts";
import {
  MultiClassFiniteQueue,
  type MultiClassFiniteQueueConfig,
  type MultiClassQueueMetrics,
} from "./queue.ts";

export interface QueueResourceCandidate<A extends string> {
  action: A;
  servers: number;
  capacity: number;
  arrivalRateScale?: number;
  serviceRateScale?: number;
  fixedCost?: number;
  metadata?: Record<string, unknown>;
}

export type QueueResourceCostBreakdownLike<C extends string> =
  Partial<QueueResourceCostBreakdown<C>> & {
    totalCost: number;
  };

export interface QueueResourceCostFunctionInput<C extends string, A extends string> {
  candidate: QueueResourceCandidate<A>;
  arrivalRates: Record<C, number>;
  metrics: MultiClassQueueMetrics<C>;
  defaultCosts: QueueResourceCostBreakdown<C>;
}

export interface QueueResourceOptimizerConfig<C extends string, A extends string> {
  classes: readonly C[];
  priorityOrder: readonly C[];
  arrivalRates: Record<C, number>;
  serviceRates: Record<C, number>;
  candidates: readonly QueueResourceCandidate<A>[];
  waitingCosts: Record<C, number>;
  rejectionCosts: Record<C, number>;
  serverCost: number;
  capacityCost: number;
  serviceDiscipline?: MultiClassFiniteQueueConfig<C>["serviceDiscipline"];
  admissionPolicy?: MultiClassFiniteQueueConfig<C>["admissionPolicy"];
  costFunction?: (input: QueueResourceCostFunctionInput<C, A>) => QueueResourceCostBreakdownLike<C>;
  actionValue?: (
    costs: QueueResourceCostBreakdownLike<C>,
    input: QueueResourceCostFunctionInput<C, A>,
  ) => number;
}

export interface QueueResourceCostBreakdown<C extends string> {
  waitingCost: number;
  rejectionCost: number;
  serverCost: number;
  capacityCost: number;
  fixedCost: number;
  totalCost: number;
  rejectionCostByClass: Distribution<C>;
  waitingCostByClass: Distribution<C>;
}

export interface QueueResourceEvaluation<C extends string, A extends string> {
  action: A;
  actionValue: number;
  candidate: QueueResourceCandidate<A>;
  metrics: MultiClassQueueMetrics<C>;
  costs: QueueResourceCostBreakdownLike<C>;
}

export interface QueueResourceOptimizationResult<C extends string, A extends string> {
  recommendedAction: A;
  actionValues: Record<A, number>;
  evaluations: Record<A, QueueResourceEvaluation<C, A>>;
  best: QueueResourceEvaluation<C, A>;
}

export class QueueResourceOptimizer<C extends string, A extends string> {
  readonly config: QueueResourceOptimizerConfig<C, A>;

  constructor(config: QueueResourceOptimizerConfig<C, A>) {
    if (config.candidates.length === 0) {
      throw new Error("QueueResourceOptimizer requires at least one candidate action");
    }
    this.config = {
      ...config,
      candidates: config.candidates.map((candidate) => ({ ...candidate })),
    };
    validateCostRecord(config.classes, config.waitingCosts, "waiting cost");
    validateCostRecord(config.classes, config.rejectionCosts, "rejection cost");
    assertNonnegative(config.serverCost, "serverCost");
    assertNonnegative(config.capacityCost, "capacityCost");
  }

  evaluate(options: { arrivalRateScale?: number } = {}): QueueResourceOptimizationResult<C, A> {
    const globalArrivalScale = options.arrivalRateScale ?? 1;
    assertNonnegative(globalArrivalScale, "arrivalRateScale");
    const evaluations = {} as Record<A, QueueResourceEvaluation<C, A>>;
    const actionValues = {} as Record<A, number>;
    let best: QueueResourceEvaluation<C, A> | undefined;

    for (const candidate of this.config.candidates) {
      const arrivalScale = candidate.arrivalRateScale ?? 1;
      const serviceScale = candidate.serviceRateScale ?? 1;
      const fixedCost = candidate.fixedCost ?? 0;
      assertNonnegative(arrivalScale, "candidate arrivalRateScale");
      assertPositive(serviceScale, "candidate serviceRateScale");
      assertNonnegative(fixedCost, "candidate fixedCost");
      if (candidate.capacity < candidate.servers) {
        throw new Error("candidate capacity must be at least candidate servers");
      }

      const queueConfig: MultiClassFiniteQueueConfig<C> = {
        classes: this.config.classes,
        priorityOrder: this.config.priorityOrder,
        arrivalRates: scaleRates(this.config.classes, this.config.arrivalRates, globalArrivalScale * arrivalScale),
        serviceRates: scaleRates(this.config.classes, this.config.serviceRates, serviceScale),
        servers: candidate.servers,
        capacity: candidate.capacity,
        serviceDiscipline: this.config.serviceDiscipline,
        admissionPolicy: this.config.admissionPolicy,
      };
      const queue = new MultiClassFiniteQueue(queueConfig);
      const metrics = queue.metrics();
      const defaultCosts = this.costBreakdown(candidate, queueConfig.arrivalRates, metrics, fixedCost);
      const costInput = {
        candidate,
        arrivalRates: queueConfig.arrivalRates,
        metrics,
        defaultCosts,
      };
      const costs = validateCostBreakdown(
        this.config.costFunction?.(costInput) ?? defaultCosts,
      );
      const actionValue = validateActionValue(
        this.config.actionValue?.(costs, costInput) ?? -costs.totalCost,
      );
      const evaluation: QueueResourceEvaluation<C, A> = {
        action: candidate.action,
        actionValue,
        candidate,
        metrics,
        costs,
      };

      evaluations[candidate.action] = evaluation;
      actionValues[candidate.action] = evaluation.actionValue;
      if (!best || evaluation.actionValue > best.actionValue) {
        best = evaluation;
      }
    }

    return {
      recommendedAction: best!.action,
      actionValues,
      evaluations,
      best: best!,
    };
  }

  private costBreakdown(
    candidate: QueueResourceCandidate<A>,
    arrivalRates: Record<C, number>,
    metrics: MultiClassQueueMetrics<C>,
    fixedCost: number,
  ): QueueResourceCostBreakdown<C> {
    const rejectionCostByClass = zeroByClass(this.config.classes);
    const waitingCostByClass = zeroByClass(this.config.classes);
    let rejectionCost = 0;
    let waitingCost = 0;
    for (const cls of this.config.classes) {
      rejectionCostByClass[cls] = this.config.rejectionCosts[cls] *
        arrivalRates[cls] *
        metrics.blockingProbabilityByClass[cls]!;
      waitingCostByClass[cls] = this.config.waitingCosts[cls] *
        metrics.queueLengthByClass[cls]!;
      rejectionCost += rejectionCostByClass[cls]!;
      waitingCost += waitingCostByClass[cls]!;
    }
    const serverCost = candidate.servers * this.config.serverCost;
    const capacityCost = candidate.capacity * this.config.capacityCost;
    return {
      waitingCost,
      rejectionCost,
      serverCost,
      capacityCost,
      fixedCost,
      totalCost: waitingCost + rejectionCost + serverCost + capacityCost + fixedCost,
      rejectionCostByClass,
      waitingCostByClass,
    };
  }
}

function scaleRates<C extends string>(
  classes: readonly C[],
  rates: Record<C, number>,
  scale: number,
): Record<C, number> {
  const result = {} as Record<C, number>;
  for (const cls of classes) {
    result[cls] = rates[cls] * scale;
  }
  return result;
}

function validateCostRecord<C extends string>(
  classes: readonly C[],
  costs: Record<C, number>,
  label: string,
) {
  for (const cls of classes) {
    assertNonnegative(costs[cls], `${label} for ${String(cls)}`);
  }
}

function zeroByClass<C extends string>(classes: readonly C[]): Distribution<C> {
  const result = {} as Distribution<C>;
  for (const cls of classes) result[cls] = 0;
  return result;
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

function validateCostBreakdown<C extends string>(
  costs: QueueResourceCostBreakdownLike<C>,
): QueueResourceCostBreakdownLike<C> {
  if (!Number.isFinite(costs.totalCost)) {
    throw new Error("costFunction must return a finite totalCost");
  }
  return costs;
}

function validateActionValue(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error("actionValue must return a finite number");
  }
  return value;
}
