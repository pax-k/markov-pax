import { describe, expect, test } from "bun:test";
import {
  DisruptedSupplyNetwork,
  InventorySystem,
  LocationAllocationOptimizer,
  PerishableInventory,
  RouteAvailabilityModel,
  SupplyNetwork,
  accessibilityMetrics,
  minCostFlow,
  multiProductFlow,
  resilienceMetrics,
  supplyRouteKey,
} from "../index.ts";

function sum(values: Iterable<number>) {
  return Array.from(values).reduce((total, value) => total + value, 0);
}

const network = SupplyNetwork.from({
  nodes: ["Depot", "Hub", "Clinic", "Shelter"] as const,
  routes: [
    { from: "Depot", to: "Hub", capacity: 10, cost: 1, time: 2 },
    { from: "Hub", to: "Clinic", capacity: 6, cost: 1, time: 2 },
    { from: "Hub", to: "Shelter", capacity: 5, cost: 2, time: 3 },
    { from: "Depot", to: "Shelter", capacity: 2, cost: 8, time: 8 },
  ],
});

describe("SupplyNetwork and disruptions", () => {
  test("finds routes, outgoing arcs, shortest paths, and disrupted capacities", () => {
    expect(supplyRouteKey("Depot", "Hub")).toBe("Depot->Hub");
    expect(network.route("Depot", "Hub").capacity).toBe(10);
    expect(network.outgoing("Depot")).toHaveLength(2);
    expect(network.shortestPath("Depot", "Shelter", "cost").routeKeys).toEqual(["Depot->Hub", "Hub->Shelter"]);
    expect(network.shortestPath("Depot", "Shelter", "time").time).toBe(5);

    const residual = network.withRouteCapacities({ "Depot->Hub": 3 });
    expect(residual.route("Depot", "Hub").capacity).toBe(3);

    const disrupted = new DisruptedSupplyNetwork(network, {
      unavailableRoutes: ["Hub->Shelter"],
      routeCapacityScale: { "Depot->Hub": 0.5 },
      routeCostScale: { "Depot->Shelter": 2 },
      routeTimeScale: { "Depot->Shelter": 1.5 },
      globalCapacityScale: 0.8,
      globalCostScale: 1.2,
      globalTimeScale: 1.1,
    }).apply();
    expect(disrupted.route("Hub", "Shelter").available).toBe(false);
    expect(disrupted.route("Depot", "Hub").capacity).toBe(4);
    expect(disrupted.route("Depot", "Shelter").cost).toBeCloseTo(19.2);
    expect(disrupted.route("Depot", "Shelter").time).toBeCloseTo(13.2);

    const nodeClosed = new DisruptedSupplyNetwork(network, { unavailableNodes: ["Hub"] }).apply();
    expect(nodeClosed.route("Depot", "Hub").available).toBe(false);
    expect(() => nodeClosed.shortestPath("Depot", "Clinic")).toThrow(/No available path/i);
  });

  test("rejects invalid networks and disruptions", () => {
    expect(() => new SupplyNetwork({ nodes: [], routes: [] })).toThrow(/at least one node/i);
    expect(() => new SupplyNetwork({ nodes: ["A"], routes: [{ from: "A", to: "B" as "A", capacity: 1, cost: 1, time: 1 }] })).toThrow(/unknown node/i);
    expect(() => new SupplyNetwork({ nodes: ["A", "B"], routes: [
      { from: "A", to: "B", capacity: 1, cost: 1, time: 1 },
      { from: "A", to: "B", capacity: 1, cost: 1, time: 1 },
    ] })).toThrow(/duplicate route/i);
    expect(() => new SupplyNetwork({ nodes: ["A", "B"], routes: [{ from: "A", to: "B", capacity: -1, cost: 1, time: 1 }] })).toThrow(/capacity/i);
    expect(() => new SupplyNetwork({ nodes: ["A", "B"], routes: [{ from: "A", to: "B", capacity: 1, cost: -1, time: 1 }] })).toThrow(/cost/i);
    expect(() => new SupplyNetwork({ nodes: ["A", "B"], routes: [{ from: "A", to: "B", capacity: 1, cost: 1, time: -1 }] })).toThrow(/time/i);
    expect(() => network.route("Clinic", "Depot")).toThrow(/unknown route/i);
    expect(() => network.outgoing("Missing" as "Depot")).toThrow(/unknown node/i);
    expect(() => network.shortestPath("Missing" as "Depot", "Clinic")).toThrow(/unknown node/i);
    expect(() => new DisruptedSupplyNetwork(network, { unavailableNodes: ["Missing" as "Depot"] }).apply()).toThrow(/unknown disrupted node/i);
    expect(() => new DisruptedSupplyNetwork(network, { unavailableRoutes: ["Missing->Route"] }).apply()).toThrow(/unknown route key/i);
    expect(() => new DisruptedSupplyNetwork(network, { routeCapacityScale: { "Depot->Hub": -1 } }).apply()).toThrow(/routeCapacityScale/i);
    expect(() => new DisruptedSupplyNetwork(network, { routeTimeScale: { "Depot->Hub": -1 } }).apply()).toThrow(/routeTimeScale/i);
    expect(() => new DisruptedSupplyNetwork(network, { routeCostScale: { "Depot->Hub": -1 } }).apply()).toThrow(/routeCostScale/i);
    expect(() => new DisruptedSupplyNetwork(network, { globalCapacityScale: -1 }).apply()).toThrow(/globalCapacityScale/i);
    expect(() => new DisruptedSupplyNetwork(network, { globalTimeScale: -1 }).apply()).toThrow(/globalTimeScale/i);
    expect(() => new DisruptedSupplyNetwork(network, { globalCostScale: -1 }).apply()).toThrow(/globalCostScale/i);
  });
});

describe("RouteAvailabilityModel", () => {
  test("forecasts route status and expected capacity", () => {
    const model = new RouteAvailabilityModel({
      transitions: {
        Open: { Open: 0.8, Blocked: 0.2 },
        Blocked: { Open: 0.5, Blocked: 0.5 },
      },
      capacityByStatus: { Open: 1, Blocked: 0.1 },
    });
    const forecast = model.forecast({ Open: 1 }, 2);
    expect(sum(Object.values(forecast))).toBeCloseTo(1);
    expect(model.mostLikely({ Open: 1 }, 2)).toBe("Open");
    expect(model.expectedCapacity(10, forecast)).toBeGreaterThan(5);
    expect(() => model.expectedCapacity(-1, forecast)).toThrow(/baseCapacity/i);
  });
});

describe("InventorySystem and PerishableInventory", () => {
  test("serves demand, tracks shortage, and allocates FEFO cold-chain lots", () => {
    const inventory = new InventorySystem({
      facilities: ["Depot", "Hub"],
      products: ["Food", "Medicine"],
      quantities: { Depot: { Food: 10, Medicine: 2 }, Hub: { Food: 3, Medicine: 4 } },
      capacities: { Depot: 20, Hub: 10 },
      shortageCosts: { Food: 5, Medicine: 100 },
    });
    expect(inventory.quantity("Depot", "Food")).toBe(10);
    expect(inventory.total("Medicine")).toBe(6);
    const served = inventory.serveDemand({ Food: 12, Medicine: 8 }, ["Hub", "Depot"]);
    expect(served.served.Food).toBe(12);
    expect(served.unmet.Medicine).toBe(2);
    expect(served.shortageCost).toBe(200);
    expect(() => inventory.quantity("Missing" as "Depot", "Food")).toThrow(/unknown facility/i);
    expect(() => inventory.total("Water" as "Food")).toThrow(/unknown product/i);
    expect(() => inventory.serveDemand({ Food: -1 })).toThrow(/demand/i);

    const perishable = new PerishableInventory({
      facilities: ["Depot", "Hub"],
      products: ["Medicine"],
      lots: [
        { facility: "Depot", product: "Medicine", quantity: 2, expiresAt: 5 },
        { facility: "Hub", product: "Medicine", quantity: 3, expiresAt: 3 },
        { facility: "Hub", product: "Medicine", quantity: 4, expiresAt: 9, coldChainOk: false },
      ],
    });
    expect(perishable.spoilage(4).Medicine).toBe(7);
    const allocation = perishable.allocate("Medicine", 4, 1);
    expect(allocation.allocations.map((lot) => lot.facility)).toEqual(["Hub", "Depot"]);
    expect(allocation.unmet).toBe(0);
    expect(() => perishable.spoilage(-1)).toThrow(/currentTime/i);
    expect(() => perishable.allocate("Water" as "Medicine", 1, 1)).toThrow(/unknown product/i);
    expect(() => perishable.allocate("Medicine", -1, 1)).toThrow(/quantity/i);
    expect(() => perishable.allocate("Medicine", 1, -1)).toThrow(/currentTime/i);
    expect(() => perishable.allocate("Medicine", 1, 1, ["Missing" as "Depot"])).toThrow(/unknown facility/i);
  });

  test("rejects invalid inventory definitions", () => {
    expect(() => new InventorySystem({
      facilities: ["Depot"],
      products: ["Food"],
      quantities: { Depot: { Food: -1 } },
    })).toThrow(/quantity/i);
    expect(() => new InventorySystem({
      facilities: ["Depot"],
      products: ["Food"],
      quantities: { Depot: { Food: 5 } },
      capacities: { Depot: 4 },
    })).toThrow(/exceeds capacity/i);
    expect(() => new InventorySystem({
      facilities: ["Depot"],
      products: ["Food"],
      quantities: { Depot: { Food: 1 } },
      capacities: { Depot: -1 },
    })).toThrow(/capacity/i);
    expect(() => new PerishableInventory({
      facilities: ["Depot"],
      products: ["Food"],
      lots: [{ facility: "Missing" as "Depot", product: "Food", quantity: 1, expiresAt: 1 }],
    })).toThrow(/unknown lot facility/i);
    expect(() => new PerishableInventory({
      facilities: ["Depot"],
      products: ["Food"],
      lots: [{ facility: "Depot", product: "Water" as "Food", quantity: 1, expiresAt: 1 }],
    })).toThrow(/unknown lot product/i);
    expect(() => new PerishableInventory({
      facilities: ["Depot"],
      products: ["Food"],
      lots: [{ facility: "Depot", product: "Food", quantity: -1, expiresAt: 1 }],
    })).toThrow(/lot quantity/i);
    expect(() => new PerishableInventory({
      facilities: ["Depot"],
      products: ["Food"],
      lots: [{ facility: "Depot", product: "Food", quantity: 1, expiresAt: -1 }],
    })).toThrow(/expiresAt/i);
  });
});

describe("flow optimizers and metrics", () => {
  test("solves finite min-cost and priority multi-product flows", () => {
    const result = minCostFlow({
      network,
      supplies: { Depot: 8 },
      demands: { Clinic: 5, Shelter: 5 },
      unmetPenalty: 50,
    });
    expect(result.delivered.Clinic).toBe(5);
    expect(result.delivered.Shelter).toBeGreaterThan(0);
    expect(result.totalUnmet).toBeGreaterThan(0);
    expect(result.routeFlows["Depot->Hub"]).toBeGreaterThan(0);

    const noDemand = minCostFlow({ network, supplies: { Depot: 1 }, demands: {} });
    expect(noDemand.totalDelivered).toBe(0);
    expect(noDemand.totalUnmet).toBe(0);

    const productFlow = multiProductFlow({
      network,
      products: ["Medicine", "Food"],
      priorityOrder: ["Medicine", "Food"],
      supplies: {
        Medicine: { Depot: 4 },
        Food: { Depot: 10 },
      },
      demands: {
        Medicine: { Clinic: 4 },
        Food: { Clinic: 4, Shelter: 3 },
      },
      unmetPenalty: { Medicine: 200, Food: 20 },
    });
    expect(productFlow.perProduct.Medicine.totalDelivered).toBe(4);
    expect(productFlow.residualCapacities["Depot->Hub"]).toBeLessThan(10);

    expect(() => minCostFlow({ network, supplies: { Depot: -1 }, demands: {} })).toThrow(/supply/i);
    expect(() => minCostFlow({ network, supplies: {}, demands: { Clinic: -1 } })).toThrow(/demand/i);
    expect(() => minCostFlow({ network, supplies: {}, demands: {}, unmetPenalty: -1 })).toThrow(/unmetPenalty/i);
    expect(() => multiProductFlow({
      network,
      products: ["Food", "Medicine"],
      priorityOrder: ["Food"],
      supplies: { Food: {}, Medicine: {} },
      demands: { Food: {}, Medicine: {} },
    })).toThrow(/priorityOrder/i);
    expect(() => multiProductFlow({
      network,
      products: ["Food", "Medicine"],
      priorityOrder: ["Food", "Water" as "Medicine"],
      supplies: { Food: {}, Medicine: {} },
      demands: { Food: {}, Medicine: {} },
    })).toThrow(/unknown priority product/i);
  });

  test("evaluates location allocation candidates and resilience metrics", () => {
    const optimizer = new LocationAllocationOptimizer({
      network,
      supplies: { Depot: 10 },
      demands: { Shelter: 6 },
      candidates: [
        { action: "Baseline", unavailableRoutes: ["Hub->Shelter"] },
        { action: "RepairRoute", fixedCost: 2 },
      ],
      unmetPenalty: 100,
    });
    const plan = optimizer.evaluate();
    expect(plan.recommendedAction).toBe("RepairRoute");
    expect(plan.best.totalCost).toBeLessThan(plan.evaluations.Baseline.totalCost);

    const access = accessibilityMetrics({
      demand: { Clinic: 10, Shelter: 10 },
      delivered: { Clinic: 10, Shelter: 5 },
      responseTimeByZone: { Clinic: 3, Shelter: 7 },
    });
    expect(access.accessibility).toBe(0.75);
    expect(access.equityGap).toBe(0.5);
    expect((access.responseTimeByZone as Record<string, number>).Shelter).toBe(7);
    expect(access.unmetDemand).toBe(5);
    expect(accessibilityMetrics({ demand: {}, delivered: {} }).accessibility).toBe(1);
    expect(() => accessibilityMetrics({ demand: { Clinic: -1 }, delivered: {} })).toThrow(/demand/i);
    expect(() => accessibilityMetrics({ demand: { Clinic: 1 }, delivered: { Clinic: -1 } })).toThrow(/delivered/i);

    const resilience = resilienceMetrics({
      accessibility: 0.8,
      baselineAccessibility: 1,
      responseTime: 12,
      baselineResponseTime: 10,
      cost: 120,
      baselineCost: 100,
    });
    expect(resilience.resilienceIndex).toBeGreaterThan(0);
    expect(resilienceMetrics({ accessibility: 0, baselineAccessibility: 0, responseTime: 0, cost: 0 }).resilienceIndex).toBe(1);
    expect(resilienceMetrics({ accessibility: 1, baselineAccessibility: 0, responseTime: 10, baselineResponseTime: 0, cost: 10, baselineCost: 0 }).serviceRetention).toBe(0);
    expect(() => resilienceMetrics({ accessibility: 1, weights: { service: 0, responseTime: 0, cost: 0 } })).toThrow(/weight/i);
    expect(() => resilienceMetrics({ accessibility: 1, weights: { service: -1 } })).toThrow(/service weight/i);
    expect(() => resilienceMetrics({ accessibility: -1 })).toThrow(/resilience numerator/i);
    expect(() => new LocationAllocationOptimizer({ network, supplies: {}, demands: {}, candidates: [] })).toThrow(/candidate/i);
    expect(() => new LocationAllocationOptimizer({ network, supplies: {}, demands: {}, candidates: [{ action: "Bad" }], unmetPenalty: -1 })).toThrow(/unmetPenalty/i);
    expect(() => new LocationAllocationOptimizer({ network, supplies: {}, demands: {}, candidates: [{ action: "Bad", fixedCost: -1 }] }).evaluate()).toThrow(/fixedCost/i);
  });
});
