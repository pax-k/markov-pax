import { MarkovChain } from "../chains/markov-chain.ts";
import { NonHomogeneousPoissonProcess, type PiecewiseConstantRate } from "../models/arrival-process.ts";
import { POMDP, type POMDPConfig } from "../models/mdp.ts";
import {
  DisruptedSupplyNetwork,
  PerishableInventory,
  SupplyNetwork,
  type MinCostFlowResult,
  type NetworkDisruption,
  type PerishableLot,
  type SupplyRoute,
  accessibilityMetrics,
  multiProductFlow,
  resilienceMetrics,
} from "../models/supply-chain.ts";
import { type Distribution, type WeightedTransitions } from "../shared/core.ts";
import {
  createWorkflow,
  type WorkflowResult,
  type WorkflowRunInput,
  type WorkflowUncertaintyStage,
} from "./workflow.ts";

export interface DisasterSupplyCandidate<A extends string, N extends string> extends NetworkDisruption<N> {
  action: A;
  fixedCost?: number;
  rationing?: Record<string, number>;
  metadata?: Record<string, unknown>;
}

export interface DisasterSupplyChainWorkflowConfig<N extends string = string, P extends string = string, A extends string = string> {
  nodes: readonly N[];
  routes: readonly SupplyRoute<N>[];
  products: readonly P[];
  priorityOrder: readonly P[];
  supplies: Record<P, Partial<Record<N, number>>>;
  demands: Record<P, Partial<Record<N, number>>>;
  candidateActions: readonly DisasterSupplyCandidate<A, N>[];
  unmetPenalty?: Partial<Record<P, number>>;
  perishableLots?: readonly PerishableLot<N, P>[];
  currentTime?: number;
  demandProcess?: { intervals: readonly PiecewiseConstantRate[]; horizon: number; demandScalePerEvent?: number; seed?: number };
  disruptionInference?: { model: POMDPConfig<string, string, string>; belief: Partial<Distribution<string>>; action: string; observation?: string };
  forecast?: { transitions: WeightedTransitions<string>; distribution: Partial<Distribution<string>>; steps: number };
  uncertainty?: WorkflowUncertaintyStage;
  objectiveWeights?: { accessibility?: number; resilience?: number; cost?: number; equity?: number; responseTime?: number };
}

export interface DisasterSupplyChainInput extends WorkflowRunInput {
  surgeMultiplier?: number;
  disruptionObservation?: string;
  forecastDistribution?: Partial<Distribution<string>>;
  forecastSteps?: number;
}

export function disasterSupplyChainWorkflow<N extends string, P extends string, A extends string>(
  config: DisasterSupplyChainWorkflowConfig<N, P, A>,
) {
  const baseNetwork = new SupplyNetwork({ nodes: config.nodes, routes: config.routes });
  validateWorkflowConfig(config);

  return {
    plan(input: DisasterSupplyChainInput = {}): WorkflowResult {
      const result = runOptionalWorkflow(config, input);
      const demandScale = demandScaleFrom(input, config);
      const evaluations = {} as Record<A, DisasterCandidateEvaluation<N, P, A>>;
      let best: DisasterCandidateEvaluation<N, P, A> | undefined;

      for (const candidate of config.candidateActions) {
        const evaluation = evaluateCandidate(baseNetwork, config, candidate, demandScale);
        evaluations[candidate.action] = evaluation;
        if (!best || evaluation.actionValue > best.actionValue) best = evaluation;
      }

      result.recommendedAction = best!.action;
      result.actionValues = actionValues(config.candidateActions, evaluations);
      result.forecast ??= best!.accessibility;
      result.details.flowPlan = best!.flowPlan;
      result.details.inventoryAfterPlan = best!.inventoryAfterPlan;
      result.details.accessibility = best!.accessibility;
      result.details.resilience = best!.resilience;
      result.details.routePlan = best!.routePlan;
      result.details.reconstructionPlan = best!.reconstructionPlan;
      result.details.candidateEvaluations = evaluations;
      result.details.unmetDemand = best!.accessibility.unmetDemand;
      result.details.responseTimeByZone = best!.accessibility.responseTimeByZone;
      result.details.equityGap = best!.accessibility.equityGap;
      result.details.bestPlan = best;
      return result;
    },
  };
}

interface DisasterCandidateEvaluation<N extends string, P extends string, A extends string> {
  action: A;
  actionValue: number;
  flowPlan: ReturnType<typeof multiProductFlow<N, P>>;
  inventoryAfterPlan: Record<P, { spoilage: number; allocated: number; unmet: number }>;
  accessibility: ReturnType<typeof accessibilityMetrics<N>>;
  resilience: ReturnType<typeof resilienceMetrics>;
  routePlan: Record<N, { path: N[]; time: number } | undefined>;
  reconstructionPlan: DisasterSupplyCandidate<A, N>;
  totalCost: number;
}

function evaluateCandidate<N extends string, P extends string, A extends string>(
  baseNetwork: SupplyNetwork<N>,
  config: DisasterSupplyChainWorkflowConfig<N, P, A>,
  candidate: DisasterSupplyCandidate<A, N>,
  demandScale: number,
): DisasterCandidateEvaluation<N, P, A> {
  assertNonnegative(candidate.fixedCost ?? 0, `fixedCost.${String(candidate.action)}`);
  const network = new DisruptedSupplyNetwork(baseNetwork, candidate).apply();
  const demands = scaledDemands(config.products, config.demands, candidate.rationing ?? {}, demandScale);
  const flowPlan = multiProductFlow({
    network,
    products: config.products,
    priorityOrder: config.priorityOrder,
    supplies: config.supplies,
    demands,
    unmetPenalty: config.unmetPenalty,
  });
  const delivered = aggregateDelivered(config.products, flowPlan.perProduct);
  const demand = aggregateDemand(config.products, demands);
  const routePlan = responseRoutes(network, config.nodes, config.supplies, demand);
  const responseTimes = responseTimesFrom(config.nodes, routePlan);
  const accessibility = accessibilityMetrics({ demand, delivered, responseTimeByZone: responseTimes });
  const totalCost = config.products.reduce((sum, product) => sum + flowPlan.perProduct[product].totalCost, 0) + (candidate.fixedCost ?? 0);
  const averageResponseTime = average(config.nodes.map((node) => responseTimes[node] ?? 0));
  const resilience = resilienceMetrics({
    accessibility: accessibility.accessibility,
    responseTime: averageResponseTime,
    cost: totalCost,
    baselineAccessibility: 1,
    baselineResponseTime: averageResponseTime === 0 ? 0 : averageResponseTime * 0.8,
    baselineCost: totalCost === 0 ? 0 : totalCost * 0.8,
  });
  const inventoryAfterPlan = perishableSummary(config, demands);
  const weights = config.objectiveWeights ?? {};
  const actionValue = (weights.accessibility ?? 100) * accessibility.accessibility +
    (weights.resilience ?? 20) * resilience.resilienceIndex -
    (weights.cost ?? 1) * totalCost -
    (weights.equity ?? 25) * accessibility.equityGap -
    (weights.responseTime ?? 1) * averageResponseTime;
  return {
    action: candidate.action,
    actionValue,
    flowPlan,
    inventoryAfterPlan,
    accessibility,
    resilience,
    routePlan,
    reconstructionPlan: candidate,
    totalCost,
  };
}

function runOptionalWorkflow<N extends string, P extends string, A extends string>(
  config: DisasterSupplyChainWorkflowConfig<N, P, A>,
  input: DisasterSupplyChainInput,
): WorkflowResult {
  const workflow = createWorkflow({ name: "disaster supply chain" });
  let hasStage = false;
  if (config.disruptionInference) {
    workflow.withInference({
      kind: "pomdp",
      model: POMDP.from(config.disruptionInference.model),
      belief: input.belief ?? config.disruptionInference.belief,
      action: input.action ?? config.disruptionInference.action,
      observation: input.disruptionObservation ?? input.observation ?? config.disruptionInference.observation,
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

function demandScaleFrom<N extends string, P extends string, A extends string>(
  input: DisasterSupplyChainInput,
  config: DisasterSupplyChainWorkflowConfig<N, P, A>,
): number {
  const surge = input.surgeMultiplier ?? 1;
  assertNonnegative(surge, "surgeMultiplier");
  if (!config.demandProcess) return surge;
  const expectedEvents = new NonHomogeneousPoissonProcess(config.demandProcess.intervals)
    .expectedCount(config.demandProcess.horizon);
  return surge * (1 + expectedEvents * (config.demandProcess.demandScalePerEvent ?? 0));
}

function actionValues<N extends string, P extends string, A extends string>(
  candidates: readonly DisasterSupplyCandidate<A, N>[],
  evaluations: Record<A, DisasterCandidateEvaluation<N, P, A>>,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const candidate of candidates) result[candidate.action] = evaluations[candidate.action].actionValue;
  return result;
}

function responseTimesFrom<N extends string>(
  nodes: readonly N[],
  routePlan: Record<N, { path: N[]; time: number } | undefined>,
): Partial<Record<N, number>> {
  const result: Partial<Record<N, number>> = {};
  for (const node of nodes) result[node] = routePlan[node]?.time ?? 0;
  return result;
}

function scaledDemands<N extends string, P extends string>(
  products: readonly P[],
  base: Record<P, Partial<Record<N, number>>>,
  rationing: Record<string, number>,
  scale: number,
): Record<P, Partial<Record<N, number>>> {
  const result = {} as Record<P, Partial<Record<N, number>>>;
  for (const product of products) {
    const factor = rationing[product] ?? 1;
    assertPositiveScale(factor, `rationing.${String(product)}`);
    result[product] = {};
    for (const [node, demand] of Object.entries(base[product] ?? {}) as [N, number][]) {
      assertNonnegative(demand, `demand.${String(product)}.${String(node)}`);
      result[product][node] = demand * scale * factor;
    }
  }
  return result;
}

function aggregateDemand<N extends string, P extends string>(
  products: readonly P[],
  demands: Record<P, Partial<Record<N, number>>>,
): Partial<Record<N, number>> {
  const result: Partial<Record<N, number>> = {};
  for (const product of products) {
    for (const [node, demand] of Object.entries(demands[product]) as [N, number][]) {
      result[node] = (result[node] ?? 0) + demand;
    }
  }
  return result;
}

function aggregateDelivered<N extends string, P extends string>(
  products: readonly P[],
  perProduct: Record<P, MinCostFlowResult<N>>,
): Partial<Record<N, number>> {
  const result: Partial<Record<N, number>> = {};
  for (const product of products) {
    for (const [node, delivered] of Object.entries(perProduct[product].delivered) as [N, number][]) {
      result[node] = (result[node] ?? 0) + delivered;
    }
  }
  return result;
}

function responseRoutes<N extends string, P extends string>(
  network: SupplyNetwork<N>,
  nodes: readonly N[],
  supplies: Record<P, Partial<Record<N, number>>>,
  demand: Partial<Record<N, number>>,
): Record<N, { path: N[]; time: number } | undefined> {
  const supplyNodes = nodes.filter((node) => {
    for (const byNode of Object.values(supplies) as Partial<Record<N, number>>[]) {
      if ((byNode[node] ?? 0) > 0) return true;
    }
    return false;
  });
  const result = {} as Record<N, { path: N[]; time: number } | undefined>;
  for (const node of nodes) {
    if ((demand[node] ?? 0) <= 0) continue;
    let best: { path: N[]; time: number } | undefined;
    for (const supplyNode of supplyNodes) {
      try {
        const path = network.shortestPath(supplyNode, node, "time");
        if (!best || path.time < best.time) best = { path: path.nodes, time: path.time };
      } catch {
        // Missing paths are represented as undefined response routes.
      }
    }
    result[node] = best;
  }
  return result;
}

function perishableSummary<N extends string, P extends string, A extends string>(
  config: DisasterSupplyChainWorkflowConfig<N, P, A>,
  demands: Record<P, Partial<Record<N, number>>>,
): Record<P, { spoilage: number; allocated: number; unmet: number }> {
  const result = {} as Record<P, { spoilage: number; allocated: number; unmet: number }>;
  if (!config.perishableLots) {
    for (const product of config.products) result[product] = { spoilage: 0, allocated: 0, unmet: 0 };
    return result;
  }
  const inventory = new PerishableInventory({ facilities: config.nodes, products: config.products, lots: config.perishableLots });
  const spoilage = inventory.spoilage(config.currentTime ?? 0);
  for (const product of config.products) {
    const quantity = config.nodes.reduce((sum, node) => sum + (demands[product][node] ?? 0), 0);
    const allocation = inventory.allocate(product, quantity, config.currentTime ?? 0);
    result[product] = {
      spoilage: spoilage[product],
      allocated: allocation.allocations.reduce((sum, lot) => sum + lot.quantity, 0),
      unmet: allocation.unmet,
    };
  }
  return result;
}

function validateWorkflowConfig<N extends string, P extends string, A extends string>(
  config: DisasterSupplyChainWorkflowConfig<N, P, A>,
) {
  if (config.candidateActions.length === 0) throw new Error("disaster workflow requires at least one candidate action");
  for (const product of config.priorityOrder) {
    if (!config.products.includes(product)) throw new Error(`Unknown priority product: ${String(product)}`);
  }
  for (const weight of Object.values(config.objectiveWeights ?? {})) assertNonnegative(weight, "objective weight");
  for (const product of config.products) {
    if (!config.supplies[product]) throw new Error(`Missing supplies for ${String(product)}`);
    if (!config.demands[product]) throw new Error(`Missing demands for ${String(product)}`);
  }
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function assertNonnegative(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be nonnegative`);
}

function assertPositiveScale(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`${label} must be in [0, 1]`);
}
