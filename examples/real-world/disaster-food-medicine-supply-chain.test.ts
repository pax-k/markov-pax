import { describe, expect, test } from "bun:test";
import { disasterSupplyChainWorkflow } from "../../index.ts";

describe("real-world example: disaster food and medicine supply chain", () => {
  test("plans flood response across warehouses, cold-chain medicine, food access, rerouting, and rationing", () => {
    const workflow = disasterSupplyChainWorkflow({
      nodes: ["centralWarehouse", "bridgeHub", "northClinic", "southShelter", "alternateDepot"],
      routes: [
        { from: "centralWarehouse", to: "bridgeHub", capacity: 25, cost: 1, time: 1 },
        { from: "bridgeHub", to: "northClinic", capacity: 8, cost: 1, time: 2 },
        { from: "bridgeHub", to: "southShelter", capacity: 8, cost: 1, time: 2 },
        { from: "alternateDepot", to: "northClinic", capacity: 8, cost: 2, time: 1 },
        { from: "alternateDepot", to: "southShelter", capacity: 8, cost: 2, time: 1 },
      ],
      products: ["medicine", "food"],
      priorityOrder: ["medicine", "food"],
      supplies: {
        medicine: { centralWarehouse: 6, alternateDepot: 8 },
        food: { centralWarehouse: 18, alternateDepot: 10 },
      },
      demands: {
        medicine: { northClinic: 8 },
        food: { northClinic: 5, southShelter: 12 },
      },
      unmetPenalty: { medicine: 500, food: 50 },
      perishableLots: [
        { facility: "centralWarehouse", product: "medicine", quantity: 2, expiresAt: 1 },
        { facility: "alternateDepot", product: "medicine", quantity: 8, expiresAt: 10 },
      ],
      currentTime: 2,
      candidateActions: [
        { action: "hold", unavailableRoutes: ["bridgeHub->northClinic"], unavailableNodes: ["alternateDepot"] },
        { action: "openAlternateDepot", unavailableRoutes: ["bridgeHub->northClinic"], fixedCost: 5 },
        { action: "rebuildBridgeRoute", fixedCost: 3_000 },
        { action: "rationFood", unavailableRoutes: ["bridgeHub->northClinic"], unavailableNodes: ["alternateDepot"], rationing: { food: 0.6 } },
      ],
      disruptionInference: {
        model: {
          states: ["manageable", "severe"],
          actions: ["inspect"],
          observations: ["passable", "flooded"],
          transition: {
            manageable: { inspect: { manageable: 0.7, severe: 0.3 } },
            severe: { inspect: { manageable: 0.1, severe: 0.9 } },
          },
          observation: {
            manageable: { inspect: { passable: 0.8, flooded: 0.2 } },
            severe: { inspect: { passable: 0.1, flooded: 0.9 } },
          },
        },
        belief: { manageable: 0.5, severe: 0.5 },
        action: "inspect",
        observation: "flooded",
      },
    });

    const plan = workflow.plan({ disruptionObservation: "flooded", surgeMultiplier: 1.1 });

    expect(plan.recommendedAction).toBe("openAlternateDepot");
    expect(plan.belief!.severe!).toBeGreaterThan(plan.belief!.manageable!);
    expect((plan.details.accessibility as { accessibility: number }).accessibility).toBeGreaterThan(0.5);
    expect((plan.details.inventoryAfterPlan as Record<string, { spoilage: number }>).medicine!.spoilage).toBe(2);
    expect(plan.details.bestPlan).toBeDefined();
  });
});
