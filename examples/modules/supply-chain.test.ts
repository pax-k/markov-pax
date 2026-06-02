import { describe, expect, test } from "bun:test";
import {
  DisruptedSupplyNetwork,
  PerishableInventory,
  SupplyNetwork,
  accessibilityMetrics,
  minCostFlow,
  multiProductFlow,
} from "../../index.ts";

describe("module example: supply-chain logistics", () => {
  test("models disrupted routes, product flow, perishability, and access metrics", () => {
    const network = SupplyNetwork.from({
      nodes: ["warehouse", "clinic", "shelter"],
      routes: [
        { from: "warehouse", to: "clinic", capacity: 5, cost: 1, time: 2 },
        { from: "warehouse", to: "shelter", capacity: 8, cost: 2, time: 3 },
      ],
    });

    const disrupted = new DisruptedSupplyNetwork(network, {
      routeCapacityScale: { "warehouse->clinic": 0.5 },
    }).apply();

    const medicine = minCostFlow({
      network: disrupted,
      supplies: { warehouse: 5 },
      demands: { clinic: 4 },
      unmetPenalty: 100,
    });

    const combined = multiProductFlow({
      network: disrupted,
      products: ["medicine", "food"],
      priorityOrder: ["medicine", "food"],
      supplies: { medicine: { warehouse: 5 }, food: { warehouse: 10 } },
      demands: { medicine: { clinic: 4 }, food: { shelter: 7 } },
    });

    const inventory = new PerishableInventory({
      facilities: ["warehouse"],
      products: ["medicine"],
      lots: [{ facility: "warehouse", product: "medicine", quantity: 5, expiresAt: 3 }],
    });

    const access = accessibilityMetrics({
      demand: { clinic: 4 },
      delivered: medicine.delivered,
    });

    expect(disrupted.route("warehouse", "clinic").capacity).toBe(2.5);
    expect(medicine.delivered.clinic).toBe(2.5);
    expect(combined.perProduct.medicine.totalDelivered).toBeGreaterThan(0);
    expect(inventory.allocate("medicine", 3, 1).unmet).toBe(0);
    expect(access.accessibility).toBeLessThan(1);
  });
});
