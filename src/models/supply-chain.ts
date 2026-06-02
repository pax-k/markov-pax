import { MarkovChain } from "../chains/markov-chain.ts";
import {
  DEFAULT_TOLERANCE,
  type Distribution,
  type WeightedTransitions,
  uniqueValues,
} from "../shared/core.ts";

export interface SupplyRoute<N extends string = string> {
  from: N;
  to: N;
  capacity: number;
  cost: number;
  time: number;
  available?: boolean;
}

export interface SupplyPath<N extends string = string> {
  nodes: N[];
  routeKeys: string[];
  cost: number;
  time: number;
  capacity: number;
}

export function supplyRouteKey(from: string, to: string): string {
  return `${from}->${to}`;
}

export class SupplyNetwork<N extends string> {
  readonly nodes: N[];
  readonly routes: SupplyRoute<N>[];

  constructor(config: { nodes: readonly N[]; routes: readonly SupplyRoute<N>[] }) {
    this.nodes = uniqueValues(config.nodes, "node");
    if (this.nodes.length === 0) throw new Error("SupplyNetwork requires at least one node");
    const known = new Set(this.nodes);
    const seenRoutes = new Set<string>();
    this.routes = config.routes.map((route) => {
      if (!known.has(route.from) || !known.has(route.to)) {
        throw new Error(`Route contains unknown node: ${String(route.from)} -> ${String(route.to)}`);
      }
      const key = supplyRouteKey(route.from, route.to);
      if (seenRoutes.has(key)) throw new Error(`Duplicate route: ${key}`);
      seenRoutes.add(key);
      assertNonnegative(route.capacity, `capacity for ${key}`);
      assertNonnegative(route.cost, `cost for ${key}`);
      assertNonnegative(route.time, `time for ${key}`);
      return { ...route, available: route.available ?? true };
    });
  }

  static from<N extends string>(config: { nodes: readonly N[]; routes: readonly SupplyRoute<N>[] }): SupplyNetwork<N> {
    return new SupplyNetwork(config);
  }

  route(from: N, to: N): SupplyRoute<N> {
    const route = this.routes.find((candidate) => candidate.from === from && candidate.to === to);
    if (!route) throw new Error(`Unknown route: ${supplyRouteKey(from, to)}`);
    return route;
  }

  outgoing(from: N): SupplyRoute<N>[] {
    this.ensureNode(from);
    return this.routes.filter((route) => route.from === from && route.available !== false && route.capacity > DEFAULT_TOLERANCE);
  }

  shortestPath(from: N, to: N, metric: "cost" | "time" = "cost"): SupplyPath<N> {
    this.ensureNode(from);
    this.ensureNode(to);
    const distance = new Map<N, number>();
    const previous = new Map<N, { node: N; route: SupplyRoute<N> }>();
    const unvisited = new Set(this.nodes);
    for (const node of this.nodes) distance.set(node, node === from ? 0 : Infinity);

    while (unvisited.size > 0) {
      let current: N | undefined;
      let currentDistance = Infinity;
      for (const node of unvisited) {
        const value = distance.get(node)!;
        if (value < currentDistance) {
          current = node;
          currentDistance = value;
        }
      }
      if (current === undefined || currentDistance === Infinity) break;
      unvisited.delete(current);
      if (current === to) break;
      for (const route of this.outgoing(current)) {
        const candidate = currentDistance + route[metric];
        if (candidate < distance.get(route.to)!) {
          distance.set(route.to, candidate);
          previous.set(route.to, { node: current, route });
        }
      }
    }

    if (distance.get(to)! === Infinity) throw new Error(`No available path from ${String(from)} to ${String(to)}`);
    const nodes: N[] = [to];
    const routeKeys: string[] = [];
    let cost = 0;
    let time = 0;
    let capacity = Infinity;
    let cursor = to;
    while (cursor !== from) {
      const step = previous.get(cursor);
      if (!step) throw new Error(`No available path from ${String(from)} to ${String(to)}`);
      routeKeys.unshift(supplyRouteKey(step.route.from, step.route.to));
      cost += step.route.cost;
      time += step.route.time;
      capacity = Math.min(capacity, step.route.capacity);
      cursor = step.node;
      nodes.unshift(cursor);
    }
    return { nodes, routeKeys, cost, time, capacity: capacity === Infinity ? 0 : capacity };
  }

  withRouteCapacities(capacities: Record<string, number>): SupplyNetwork<N> {
    return new SupplyNetwork({
      nodes: this.nodes,
      routes: this.routes.map((route) => ({
        ...route,
        capacity: capacities[supplyRouteKey(route.from, route.to)] ?? route.capacity,
      })),
    });
  }

  private ensureNode(node: N) {
    if (!this.nodes.includes(node)) throw new Error(`Unknown node: ${String(node)}`);
  }
}

export interface NetworkDisruption<N extends string = string> {
  unavailableNodes?: readonly N[];
  unavailableRoutes?: readonly string[];
  routeCapacityScale?: Partial<Record<string, number>>;
  routeTimeScale?: Partial<Record<string, number>>;
  routeCostScale?: Partial<Record<string, number>>;
  globalCapacityScale?: number;
  globalTimeScale?: number;
  globalCostScale?: number;
}

export class DisruptedSupplyNetwork<N extends string> {
  readonly base: SupplyNetwork<N>;
  readonly disruption: NetworkDisruption<N>;

  constructor(base: SupplyNetwork<N>, disruption: NetworkDisruption<N>) {
    this.base = base;
    this.disruption = { ...disruption };
  }

  apply(): SupplyNetwork<N> {
    const unavailableNodes = new Set(this.disruption.unavailableNodes ?? []);
    const unavailableRoutes = new Set(this.disruption.unavailableRoutes ?? []);
    for (const node of unavailableNodes) {
      if (!this.base.nodes.includes(node)) throw new Error(`Unknown disrupted node: ${String(node)}`);
    }
    validateDisruptionRouteKeys(this.base, this.disruption);
    validateScale(this.disruption.globalCapacityScale ?? 1, "globalCapacityScale");
    validateScale(this.disruption.globalTimeScale ?? 1, "globalTimeScale");
    validateScale(this.disruption.globalCostScale ?? 1, "globalCostScale");
    return new SupplyNetwork({
      nodes: this.base.nodes,
      routes: this.base.routes.map((route) => {
        const key = supplyRouteKey(route.from, route.to);
        validateKnownRoute(this.base, key);
        validateScale(this.disruption.routeCapacityScale?.[key] ?? 1, `routeCapacityScale.${key}`);
        validateScale(this.disruption.routeTimeScale?.[key] ?? 1, `routeTimeScale.${key}`);
        validateScale(this.disruption.routeCostScale?.[key] ?? 1, `routeCostScale.${key}`);
        const blocked = unavailableNodes.has(route.from) || unavailableNodes.has(route.to) || unavailableRoutes.has(key);
        return {
          ...route,
          available: route.available !== false && !blocked,
          capacity: route.capacity * (this.disruption.globalCapacityScale ?? 1) * (this.disruption.routeCapacityScale?.[key] ?? 1),
          time: route.time * (this.disruption.globalTimeScale ?? 1) * (this.disruption.routeTimeScale?.[key] ?? 1),
          cost: route.cost * (this.disruption.globalCostScale ?? 1) * (this.disruption.routeCostScale?.[key] ?? 1),
        };
      }),
    });
  }
}

export class RouteAvailabilityModel<S extends string> {
  readonly chain: MarkovChain<S>;
  readonly capacityByStatus: Partial<Record<S, number>>;

  constructor(config: { transitions: WeightedTransitions<S>; capacityByStatus?: Partial<Record<S, number>> }) {
    this.chain = MarkovChain.from(config.transitions);
    this.capacityByStatus = config.capacityByStatus ?? {};
  }

  forecast(initial: Partial<Distribution<S>>, steps: number): Distribution<S> {
    return this.chain.distributionAfter(initial, steps, { normalize: true });
  }

  mostLikely(initial: Partial<Distribution<S>>, steps: number): S {
    const forecast = this.forecast(initial, steps);
    let best = this.chain.states[0]!;
    for (const state of this.chain.states) {
      if (forecast[state] > forecast[best]) best = state;
    }
    return best;
  }

  expectedCapacity(baseCapacity: number, distribution: Partial<Distribution<S>>): number {
    assertNonnegative(baseCapacity, "baseCapacity");
    let total = 0;
    for (const state of this.chain.states) {
      total += (distribution[state] ?? 0) * (this.capacityByStatus[state] ?? 1) * baseCapacity;
    }
    return total;
  }
}

export type ProductQuantities<F extends string, P extends string> = Record<F, Partial<Record<P, number>>>;

export class InventorySystem<F extends string, P extends string> {
  readonly facilities: F[];
  readonly products: P[];
  readonly quantities: Record<F, Record<P, number>>;
  readonly capacities: Partial<Record<F, number>>;
  readonly shortageCosts: Partial<Record<P, number>>;

  constructor(config: {
    facilities: readonly F[];
    products: readonly P[];
    quantities: ProductQuantities<F, P>;
    capacities?: Partial<Record<F, number>>;
    shortageCosts?: Partial<Record<P, number>>;
  }) {
    this.facilities = uniqueValues(config.facilities, "facility");
    this.products = uniqueValues(config.products, "product");
    this.capacities = config.capacities ?? {};
    this.shortageCosts = config.shortageCosts ?? {};
    this.quantities = {} as Record<F, Record<P, number>>;
    for (const facility of this.facilities) {
      const row = {} as Record<P, number>;
      let total = 0;
      for (const product of this.products) {
        const value = config.quantities[facility]?.[product] ?? 0;
        assertNonnegative(value, `quantity.${String(facility)}.${String(product)}`);
        row[product] = value;
        total += value;
      }
      const capacity = this.capacities[facility];
      if (capacity !== undefined) {
        assertNonnegative(capacity, `capacity.${String(facility)}`);
        if (total > capacity + DEFAULT_TOLERANCE) throw new Error(`Inventory exceeds capacity for ${String(facility)}`);
      }
      this.quantities[facility] = row;
    }
  }

  quantity(facility: F, product: P): number {
    this.ensureFacility(facility);
    this.ensureProduct(product);
    return this.quantities[facility][product];
  }

  total(product: P): number {
    this.ensureProduct(product);
    return this.facilities.reduce((sum, facility) => sum + this.quantities[facility][product], 0);
  }

  serveDemand(demand: Partial<Record<P, number>>, facilityOrder: readonly F[] = this.facilities) {
    const remaining = cloneQuantities(this.quantities, this.facilities, this.products);
    const served = {} as Record<P, number>;
    const unmet = {} as Record<P, number>;
    let shortageCost = 0;
    for (const facility of facilityOrder) this.ensureFacility(facility);
    for (const product of this.products) {
      let need = demand[product] ?? 0;
      assertNonnegative(need, `demand.${String(product)}`);
      let productServed = 0;
      for (const facility of facilityOrder) {
        const used = Math.min(need, remaining[facility][product]);
        remaining[facility][product] -= used;
        need -= used;
        productServed += used;
      }
      served[product] = productServed;
      unmet[product] = need;
      shortageCost += need * (this.shortageCosts[product] ?? 0);
    }
    return { served, unmet, remaining, shortageCost };
  }

  private ensureFacility(facility: F) {
    if (!this.facilities.includes(facility)) throw new Error(`Unknown facility: ${String(facility)}`);
  }

  private ensureProduct(product: P) {
    if (!this.products.includes(product)) throw new Error(`Unknown product: ${String(product)}`);
  }
}

export interface PerishableLot<F extends string = string, P extends string = string> {
  facility: F;
  product: P;
  quantity: number;
  expiresAt: number;
  coldChainOk?: boolean;
}

export class PerishableInventory<F extends string, P extends string> {
  readonly facilities: F[];
  readonly products: P[];
  readonly lots: PerishableLot<F, P>[];

  constructor(config: { facilities: readonly F[]; products: readonly P[]; lots: readonly PerishableLot<F, P>[] }) {
    this.facilities = uniqueValues(config.facilities, "facility");
    this.products = uniqueValues(config.products, "product");
    this.lots = config.lots.map((lot) => {
      if (!this.facilities.includes(lot.facility)) throw new Error(`Unknown lot facility: ${String(lot.facility)}`);
      if (!this.products.includes(lot.product)) throw new Error(`Unknown lot product: ${String(lot.product)}`);
      assertNonnegative(lot.quantity, "lot quantity");
      if (!Number.isFinite(lot.expiresAt) || lot.expiresAt < 0) throw new Error("lot expiresAt must be nonnegative");
      return { ...lot, coldChainOk: lot.coldChainOk ?? true };
    });
  }

  spoilage(currentTime: number): Record<P, number> {
    assertNonnegative(currentTime, "currentTime");
    const result = zeroBy(this.products);
    for (const lot of this.lots) {
      if (lot.expiresAt <= currentTime || lot.coldChainOk === false) result[lot.product] += lot.quantity;
    }
    return result;
  }

  allocate(product: P, quantity: number, currentTime: number, facilities: readonly F[] = this.facilities) {
    if (!this.products.includes(product)) throw new Error(`Unknown product: ${String(product)}`);
    assertNonnegative(quantity, "quantity");
    assertNonnegative(currentTime, "currentTime");
    for (const facility of facilities) {
      if (!this.facilities.includes(facility)) throw new Error(`Unknown facility: ${String(facility)}`);
    }
    let remainingNeed = quantity;
    const allocations: PerishableLot<F, P>[] = [];
    const eligible = this.lots
      .filter((lot) => lot.product === product && lot.expiresAt > currentTime && lot.coldChainOk !== false && facilities.includes(lot.facility))
      .sort((a, b) => a.expiresAt - b.expiresAt);
    for (const lot of eligible) {
      const used = Math.min(remainingNeed, lot.quantity);
      if (used > 0) allocations.push({ ...lot, quantity: used });
      remainingNeed -= used;
      if (remainingNeed <= DEFAULT_TOLERANCE) break;
    }
    return { allocations, unmet: Math.max(0, remainingNeed) };
  }
}

export interface FlowDemand<N extends string> {
  node: N;
  quantity: number;
}

export interface MinCostFlowResult<N extends string> {
  delivered: Record<N, number>;
  unmet: Record<N, number>;
  routeFlows: Record<string, number>;
  totalCost: number;
  totalDelivered: number;
  totalUnmet: number;
}

export function minCostFlow<N extends string>(config: {
  network: SupplyNetwork<N>;
  supplies: Partial<Record<N, number>>;
  demands: Partial<Record<N, number>>;
  unmetPenalty?: number;
}): MinCostFlowResult<N> {
  const unmetPenalty = config.unmetPenalty ?? 1_000;
  assertNonnegative(unmetPenalty, "unmetPenalty");
  const source = "__source";
  const sink = "__sink";
  const nodes = [source, ...config.network.nodes, sink];
  const graph = nodes.map(() => [] as ResidualEdge[]);
  const index = new Map(nodes.map((node, i) => [node, i]));
  const routeEdges: Record<string, ResidualEdge> = {};
  for (const node of config.network.nodes) {
    const supply = config.supplies[node] ?? 0;
    const demand = config.demands[node] ?? 0;
    assertNonnegative(supply, `supply.${String(node)}`);
    assertNonnegative(demand, `demand.${String(node)}`);
    if (supply > 0) addEdge(graph, index.get(source)!, index.get(node)!, supply, 0);
    if (demand > 0) {
      addEdge(graph, index.get(source)!, index.get(node)!, demand, unmetPenalty, true);
      addEdge(graph, index.get(node)!, index.get(sink)!, demand, 0);
    }
  }
  for (const route of config.network.routes) {
    if (route.available === false || route.capacity <= DEFAULT_TOLERANCE) continue;
    const edge = addEdge(graph, index.get(route.from)!, index.get(route.to)!, route.capacity, route.cost);
    routeEdges[supplyRouteKey(route.from, route.to)] = edge;
  }

  let totalDemand = 0;
  for (const node of config.network.nodes) totalDemand += config.demands[node] ?? 0;
  let sent = 0;
  let totalCost = 0;
  while (sent < totalDemand - DEFAULT_TOLERANCE) {
    const path = shortestResidualPath(graph, index.get(source)!, index.get(sink)!);
    if (!path) break;
    let amount = totalDemand - sent;
    for (const edge of path) amount = Math.min(amount, edge.capacity);
    for (const edge of path) {
      edge.capacity -= amount;
      graph[edge.to]![edge.reverse]!.capacity += amount;
      totalCost += amount * edge.cost;
    }
    sent += amount;
  }

  const delivered = zeroBy(config.network.nodes);
  const unmet = zeroBy(config.network.nodes);
  for (const edge of graph[index.get(source)!]!) {
    if (edge.unmetEdge) unmet[nodes[edge.to] as N] += graph[edge.to]![edge.reverse]!.capacity;
  }
  for (const node of config.network.nodes) {
    delivered[node] = (config.demands[node] ?? 0) - unmet[node];
  }
  const routeFlows: Record<string, number> = {};
  for (const [key, edge] of Object.entries(routeEdges)) {
    routeFlows[key] = graph[edge.to]![edge.reverse]!.capacity;
  }
  const totalUnmet = config.network.nodes.reduce((sum, node) => sum + unmet[node], 0);
  return {
    delivered,
    unmet,
    routeFlows,
    totalCost,
    totalDelivered: sent - totalUnmet,
    totalUnmet,
  };
}

export function multiProductFlow<N extends string, P extends string>(config: {
  network: SupplyNetwork<N>;
  products: readonly P[];
  priorityOrder: readonly P[];
  supplies: Record<P, Partial<Record<N, number>>>;
  demands: Record<P, Partial<Record<N, number>>>;
  unmetPenalty?: Partial<Record<P, number>>;
}) {
  const products = uniqueValues(config.products, "product");
  const priorityOrder = uniqueValues(config.priorityOrder, "priority product");
  if (priorityOrder.length !== products.length) throw new Error("priorityOrder must contain every product exactly once");
  const capacities: Record<string, number> = {};
  for (const route of config.network.routes) capacities[supplyRouteKey(route.from, route.to)] = route.capacity;
  const perProduct = {} as Record<P, MinCostFlowResult<N>>;
  for (const product of priorityOrder) {
    if (!products.includes(product)) throw new Error(`Unknown priority product: ${String(product)}`);
    const residualNetwork = config.network.withRouteCapacities(capacities);
    const result = minCostFlow({
      network: residualNetwork,
      supplies: config.supplies[product],
      demands: config.demands[product],
      unmetPenalty: config.unmetPenalty?.[product],
    });
    perProduct[product] = result;
    for (const [key, flow] of Object.entries(result.routeFlows)) capacities[key] = Math.max(0, capacities[key]! - flow);
  }
  return { perProduct, residualCapacities: capacities };
}

export interface LocationCandidate<A extends string, N extends string> extends NetworkDisruption<N> {
  action: A;
  fixedCost?: number;
}

export class LocationAllocationOptimizer<N extends string, A extends string> {
  readonly network: SupplyNetwork<N>;
  readonly candidates: LocationCandidate<A, N>[];
  readonly supplies: Partial<Record<N, number>>;
  readonly demands: Partial<Record<N, number>>;
  readonly unmetPenalty: number;

  constructor(config: {
    network: SupplyNetwork<N>;
    candidates: readonly LocationCandidate<A, N>[];
    supplies: Partial<Record<N, number>>;
    demands: Partial<Record<N, number>>;
    unmetPenalty?: number;
  }) {
    if (config.candidates.length === 0) throw new Error("LocationAllocationOptimizer requires at least one candidate");
    this.network = config.network;
    this.candidates = config.candidates.map((candidate) => ({ ...candidate }));
    this.supplies = config.supplies;
    this.demands = config.demands;
    this.unmetPenalty = config.unmetPenalty ?? 1_000;
    assertNonnegative(this.unmetPenalty, "unmetPenalty");
  }

  evaluate() {
    const evaluations = {} as Record<A, { action: A; flow: MinCostFlowResult<N>; totalCost: number; actionValue: number }>;
    let best: { action: A; flow: MinCostFlowResult<N>; totalCost: number; actionValue: number } | undefined;
    for (const candidate of this.candidates) {
      assertNonnegative(candidate.fixedCost ?? 0, `fixedCost.${String(candidate.action)}`);
      const network = new DisruptedSupplyNetwork(this.network, candidate).apply();
      const flow = minCostFlow({ network, supplies: this.supplies, demands: this.demands, unmetPenalty: this.unmetPenalty });
      const totalCost = flow.totalCost + (candidate.fixedCost ?? 0);
      const evaluation = { action: candidate.action, flow, totalCost, actionValue: -totalCost };
      evaluations[candidate.action] = evaluation;
      if (!best || evaluation.actionValue > best.actionValue) best = evaluation;
    }
    return { recommendedAction: best!.action, evaluations, best: best! };
  }
}

export function accessibilityMetrics<N extends string>(config: {
  demand: Partial<Record<N, number>>;
  delivered: Partial<Record<N, number>>;
  responseTimeByZone?: Partial<Record<N, number>>;
}) {
  const serviceByZone = {} as Record<N, number>;
  const allZones = [...new Set([...Object.keys(config.demand), ...Object.keys(config.delivered)] as N[])];
  for (const zone of allZones) {
    assertNonnegative(config.demand[zone] ?? 0, `demand.${String(zone)}`);
    assertNonnegative(config.delivered[zone] ?? 0, `delivered.${String(zone)}`);
  }
  const zones = allZones.filter((zone) => (config.demand[zone] ?? 0) > DEFAULT_TOLERANCE || (config.delivered[zone] ?? 0) > DEFAULT_TOLERANCE);
  let totalDemand = 0;
  let totalDelivered = 0;
  for (const zone of zones) {
    const demand = config.demand[zone] ?? 0;
    const delivered = config.delivered[zone] ?? 0;
    serviceByZone[zone] = demand <= DEFAULT_TOLERANCE ? 1 : Math.min(1, delivered / demand);
    totalDemand += demand;
    totalDelivered += Math.min(delivered, demand);
  }
  const values = zones.map((zone) => serviceByZone[zone]);
  const equityGap = values.length === 0 ? 0 : Math.max(...values) - Math.min(...values);
  return {
    serviceByZone,
    accessibility: totalDemand <= DEFAULT_TOLERANCE ? 1 : totalDelivered / totalDemand,
    unmetDemand: Math.max(0, totalDemand - totalDelivered),
    responseTimeByZone: config.responseTimeByZone ?? {},
    equityGap,
  };
}

export function resilienceMetrics(config: {
  accessibility: number;
  baselineAccessibility?: number;
  responseTime?: number;
  baselineResponseTime?: number;
  cost?: number;
  baselineCost?: number;
  weights?: { service?: number; responseTime?: number; cost?: number };
}) {
  const weights = config.weights ?? {};
  const serviceWeight = weights.service ?? 1;
  const responseWeight = weights.responseTime ?? 1;
  const costWeight = weights.cost ?? 1;
  assertNonnegative(serviceWeight, "service weight");
  assertNonnegative(responseWeight, "responseTime weight");
  assertNonnegative(costWeight, "cost weight");
  const serviceRetention = ratio(config.accessibility, config.baselineAccessibility ?? 1, false);
  const responseTimeRetention = ratio(config.baselineResponseTime ?? 0, config.responseTime ?? 0, true);
  const costRetention = ratio(config.baselineCost ?? 0, config.cost ?? 0, true);
  const totalWeight = serviceWeight + responseWeight + costWeight;
  if (totalWeight <= DEFAULT_TOLERANCE) throw new Error("At least one resilience weight must be positive");
  return {
    serviceRetention,
    responseTimeRetention,
    costRetention,
    resilienceIndex: (serviceWeight * serviceRetention + responseWeight * responseTimeRetention + costWeight * costRetention) / totalWeight,
  };
}

interface ResidualEdge {
  to: number;
  reverse: number;
  capacity: number;
  cost: number;
  unmetEdge?: boolean;
}

function addEdge(graph: ResidualEdge[][], from: number, to: number, capacity: number, cost: number, unmetEdge = false): ResidualEdge {
  const forward: ResidualEdge = { to, reverse: graph[to]!.length, capacity, cost, unmetEdge };
  const backward: ResidualEdge = { to: from, reverse: graph[from]!.length, capacity: 0, cost: -cost };
  graph[from]!.push(forward);
  graph[to]!.push(backward);
  return forward;
}

function shortestResidualPath(graph: ResidualEdge[][], source: number, sink: number): ResidualEdge[] | undefined {
  const distance = Array(graph.length).fill(Infinity) as number[];
  const previous: ({ node: number; edgeIndex: number } | undefined)[] = Array(graph.length).fill(undefined);
  const inQueue = Array(graph.length).fill(false) as boolean[];
  const queue = [source];
  distance[source] = 0;
  inQueue[source] = true;
  while (queue.length > 0) {
    const node = queue.shift()!;
    inQueue[node] = false;
    for (let edgeIndex = 0; edgeIndex < graph[node]!.length; edgeIndex++) {
      const edge = graph[node]![edgeIndex]!;
      const candidate = distance[node]! + edge.cost;
      if (edge.capacity > DEFAULT_TOLERANCE && candidate < distance[edge.to]! - DEFAULT_TOLERANCE) {
        distance[edge.to] = candidate;
        previous[edge.to] = { node, edgeIndex };
        if (!inQueue[edge.to]) {
          queue.push(edge.to);
          inQueue[edge.to] = true;
        }
      }
    }
  }
  if (distance[sink] === Infinity) return undefined;
  const path: ResidualEdge[] = [];
  let cursor = sink;
  while (cursor !== source) {
    const step = previous[cursor]!;
    const edge = graph[step.node]![step.edgeIndex]!;
    path.unshift(edge);
    cursor = step.node;
  }
  return path;
}

function cloneQuantities<F extends string, P extends string>(
  quantities: Record<F, Record<P, number>>,
  facilities: readonly F[],
  products: readonly P[],
): Record<F, Record<P, number>> {
  const result = {} as Record<F, Record<P, number>>;
  for (const facility of facilities) {
    result[facility] = {} as Record<P, number>;
    for (const product of products) result[facility][product] = quantities[facility][product];
  }
  return result;
}

function zeroBy<K extends string>(keys: readonly K[]): Record<K, number> {
  const result = {} as Record<K, number>;
  for (const key of keys) result[key] = 0;
  return result;
}

function validateKnownRoute<N extends string>(network: SupplyNetwork<N>, key: string) {
  if (!network.routes.some((route) => supplyRouteKey(route.from, route.to) === key)) {
    throw new Error(`Unknown route key: ${key}`);
  }
}

function validateDisruptionRouteKeys<N extends string>(network: SupplyNetwork<N>, disruption: NetworkDisruption<N>) {
  for (const key of disruption.unavailableRoutes ?? []) validateKnownRoute(network, key);
  for (const key of Object.keys(disruption.routeCapacityScale ?? {})) validateKnownRoute(network, key);
  for (const key of Object.keys(disruption.routeTimeScale ?? {})) validateKnownRoute(network, key);
  for (const key of Object.keys(disruption.routeCostScale ?? {})) validateKnownRoute(network, key);
}

function validateScale(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be nonnegative`);
}

function assertNonnegative(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be nonnegative`);
}

function ratio(numerator: number, denominator: number, inverse: boolean): number {
  assertNonnegative(numerator, "resilience numerator");
  assertNonnegative(denominator, "resilience denominator");
  if (denominator <= DEFAULT_TOLERANCE && numerator <= DEFAULT_TOLERANCE) return 1;
  if (denominator <= DEFAULT_TOLERANCE) return 0;
  const value = inverse ? denominator / Math.max(denominator, numerator) : numerator / denominator;
  return Math.max(0, Math.min(1, value));
}
