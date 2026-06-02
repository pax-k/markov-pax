import { describe, expect, test } from "bun:test";
import { disasterSupplyChainWorkflow } from "../../index.ts";

describe("module example: disaster supply-chain workflow", () => {
  test("turns disruptions and candidate actions into an explainable response plan", () => {
    const workflow = disasterSupplyChainWorkflow({
      nodes: ["depot", "bridge", "clinic", "alternate"],
      routes: [
        { from: "depot", to: "bridge", capacity: 10, cost: 1, time: 1 },
        { from: "bridge", to: "clinic", capacity: 3, cost: 1, time: 2 },
        { from: "alternate", to: "clinic", capacity: 6, cost: 2, time: 1 },
      ],
      products: ["medicine", "food"],
      priorityOrder: ["medicine", "food"],
      supplies: {
        medicine: { depot: 5, alternate: 6 },
        food: { depot: 8, alternate: 4 },
      },
      demands: {
        medicine: { clinic: 5 },
        food: { clinic: 5 },
      },
      unmetPenalty: { medicine: 300, food: 30 },
      candidateActions: [
        { action: "hold", unavailableNodes: ["alternate"] },
        { action: "open-alternate", fixedCost: 5 },
      ],
    });

    const plan = workflow.plan({ surgeMultiplier: 1.1 });

    expect(plan.recommendedAction).toBe("open-alternate");
    expect(plan.details.accessibility).toBeDefined();
    expect(plan.details.flowPlan).toBeDefined();
    expect(plan.details.bestPlan).toBeDefined();
  });
});
