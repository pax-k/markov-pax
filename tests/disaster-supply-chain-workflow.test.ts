import { describe, expect, test } from "bun:test";
import { disasterSupplyChainWorkflow } from "../index.ts";

const baseConfig = {
  nodes: ["MainDepot", "NorthHub", "SouthClinic", "EastShelter", "AltDepot"] as const,
  routes: [
    { from: "MainDepot", to: "NorthHub", capacity: 30, cost: 1, time: 1 },
    { from: "NorthHub", to: "SouthClinic", capacity: 10, cost: 1, time: 2 },
    { from: "NorthHub", to: "EastShelter", capacity: 10, cost: 1, time: 2 },
    { from: "AltDepot", to: "SouthClinic", capacity: 8, cost: 1, time: 1 },
    { from: "AltDepot", to: "EastShelter", capacity: 8, cost: 1, time: 1 },
    { from: "MainDepot", to: "EastShelter", capacity: 2, cost: 8, time: 8 },
  ],
  products: ["Medicine", "Food"] as const,
  priorityOrder: ["Medicine", "Food"] as const,
  supplies: {
    Medicine: { MainDepot: 8, AltDepot: 8 },
    Food: { MainDepot: 20, AltDepot: 10 },
  },
  demands: {
    Medicine: { SouthClinic: 8 },
    Food: { SouthClinic: 5, EastShelter: 10 },
  },
  unmetPenalty: { Medicine: 500, Food: 50 },
};

describe("disasterSupplyChainWorkflow", () => {
  test("recommends alternate depots under severe disruption with inference, forecast, perishability, and uncertainty", () => {
    const workflow = disasterSupplyChainWorkflow({
      ...baseConfig,
      candidateActions: [
        { action: "HoldPlan", unavailableRoutes: ["NorthHub->SouthClinic"], unavailableNodes: ["AltDepot"], fixedCost: 0 },
        { action: "OpenAltDepot", unavailableRoutes: ["NorthHub->SouthClinic"], fixedCost: 5 },
        { action: "RebuildRoute", fixedCost: 3_000 },
        { action: "RationFood", unavailableRoutes: ["NorthHub->SouthClinic"], unavailableNodes: ["AltDepot"], rationing: { Food: 0.5 }, fixedCost: 0 },
      ] as const,
      perishableLots: [
        { facility: "MainDepot", product: "Medicine", quantity: 2, expiresAt: 1 },
        { facility: "AltDepot", product: "Medicine", quantity: 8, expiresAt: 10 },
        { facility: "MainDepot", product: "Food", quantity: 20, expiresAt: 20 },
      ],
      currentTime: 2,
      demandProcess: { intervals: [{ start: 0, end: 2, rate: 1 }], horizon: 2, demandScalePerEvent: 0.1 },
      disruptionInference: {
        model: {
          states: ["Stable", "Severe"],
          actions: ["Observe"],
          observations: ["clear", "flooded"],
          transition: {
            Stable: { Observe: { Stable: 0.7, Severe: 0.3 } },
            Severe: { Observe: { Stable: 0.1, Severe: 0.9 } },
          },
          observation: {
            Stable: { Observe: { clear: 0.8, flooded: 0.2 } },
            Severe: { Observe: { clear: 0.1, flooded: 0.9 } },
          },
        },
        belief: { Stable: 0.5, Severe: 0.5 },
        action: "Observe",
        observation: "clear",
      },
      forecast: {
        transitions: {
          Accessible: { Accessible: 0.6, CutOff: 0.4 },
          CutOff: { Accessible: 0.2, CutOff: 0.8 },
        },
        distribution: { Accessible: 1 },
        steps: 2,
      },
      uncertainty: {
        parameter: "surge",
        initial: 1,
        logTarget: (value) => -0.5 * (value - 1) ** 2,
        iterations: 20,
        burnIn: 5,
        seed: 7,
      },
    });

    const result = workflow.plan({ disruptionObservation: "flooded", surgeMultiplier: 1.2 });

    expect(result.recommendedAction).toBe("OpenAltDepot");
    expect(result.belief!.Severe!).toBeGreaterThan(result.belief!.Stable!);
    expect(result.uncertainty!.surge!.samples.length).toBe(15);
    expect(result.details.bestPlan).toBeDefined();
    expect(result.details.flowPlan).toBeDefined();
    expect(result.details.inventoryAfterPlan).toBeDefined();
    expect(result.details.accessibility).toBeDefined();
    expect(result.details.resilience).toBeDefined();
    expect(result.details.routePlan).toBeDefined();
    expect(result.details.reconstructionPlan).toBeDefined();
    expect(result.details.candidateEvaluations).toBeDefined();
    expect(result.details.unmetDemand as number).toBeGreaterThanOrEqual(0);
    expect(result.details.responseTimeByZone).toBeDefined();
    expect(result.details.equityGap as number).toBeGreaterThanOrEqual(0);
    expect(result.actionValues!.OpenAltDepot!).toBeGreaterThan(result.actionValues!.HoldPlan!);
    expect((result.details.inventoryAfterPlan as Record<string, { spoilage: number }>).Medicine!.spoilage).toBe(2);
  });

  test("holds baseline under mild disruption and can favor equity-oriented rationing", () => {
    const mild = disasterSupplyChainWorkflow({
      ...baseConfig,
      candidateActions: [
        { action: "HoldPlan", fixedCost: 0 },
        { action: "OpenAltDepot", fixedCost: 25 },
      ] as const,
    }).plan();

    expect(mild.recommendedAction).toBe("HoldPlan");
    expect((mild.details.inventoryAfterPlan as Record<string, { spoilage: number }>).Food!.spoilage).toBe(0);

    const equity = disasterSupplyChainWorkflow({
      ...baseConfig,
      candidateActions: [
        { action: "ServeClinicOnly", unavailableRoutes: ["NorthHub->EastShelter"], unavailableNodes: ["AltDepot"] },
        { action: "RationForBothZones", unavailableNodes: ["AltDepot"], rationing: { Food: 0.5 }, fixedCost: 5 },
      ] as const,
      objectiveWeights: { accessibility: 1, resilience: 0, cost: 0, equity: 200, responseTime: 0 },
    }).plan();

    expect(equity.recommendedAction).toBe("RationForBothZones");
    expect(equity.actionValues!.RationForBothZones!).toBeGreaterThan(equity.actionValues!.ServeClinicOnly!);
  });

  test("rejects invalid configs and inputs clearly", () => {
    expect(() => disasterSupplyChainWorkflow({
      ...baseConfig,
      candidateActions: [],
    })).toThrow(/candidate/i);

    expect(() => disasterSupplyChainWorkflow({
      ...baseConfig,
      priorityOrder: ["Medicine", "Water" as "Food"],
      candidateActions: [{ action: "HoldPlan" }] as const,
    })).toThrow(/priority product/i);

    expect(() => disasterSupplyChainWorkflow({
      ...baseConfig,
      objectiveWeights: { cost: -1 },
      candidateActions: [{ action: "HoldPlan" }] as const,
    })).toThrow(/objective weight/i);

    expect(() => disasterSupplyChainWorkflow({
      ...baseConfig,
      supplies: { Medicine: { MainDepot: 1 } } as typeof baseConfig.supplies,
      candidateActions: [{ action: "HoldPlan" }] as const,
    })).toThrow(/missing supplies/i);

    expect(() => disasterSupplyChainWorkflow({
      ...baseConfig,
      demands: { Medicine: { SouthClinic: 1 } } as typeof baseConfig.demands,
      candidateActions: [{ action: "HoldPlan" }] as const,
    })).toThrow(/missing demands/i);

    expect(() => disasterSupplyChainWorkflow({
      ...baseConfig,
      candidateActions: [{ action: "Bad", fixedCost: -1 }] as const,
    }).plan()).toThrow(/fixedCost/i);

    expect(() => disasterSupplyChainWorkflow({
      ...baseConfig,
      candidateActions: [{ action: "Bad", rationing: { Food: 2 } }] as const,
    }).plan()).toThrow(/rationing/i);

    expect(() => disasterSupplyChainWorkflow({
      ...baseConfig,
      candidateActions: [{ action: "Bad", unavailableRoutes: ["Missing->Route"] }] as const,
    }).plan()).toThrow(/unknown route key/i);

    expect(() => disasterSupplyChainWorkflow({
      ...baseConfig,
      candidateActions: [{ action: "HoldPlan" }] as const,
    }).plan({ surgeMultiplier: -1 })).toThrow(/surgeMultiplier/i);
  });
});
