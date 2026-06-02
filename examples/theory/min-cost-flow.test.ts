import { describe, expect, test } from "bun:test";
import { SupplyNetwork, minCostFlow } from "../../index.ts";

describe("theory example: min-cost flow", () => {
  test("ships flow through finite capacities while pricing unmet demand", () => {
    const network = SupplyNetwork.from({
      nodes: ["source", "middle", "sink"],
      routes: [
        { from: "source", to: "middle", capacity: 4, cost: 1, time: 1 },
        { from: "middle", to: "sink", capacity: 3, cost: 1, time: 1 },
      ],
    });

    const flow = minCostFlow({
      network,
      supplies: { source: 5 },
      demands: { sink: 5 },
      unmetPenalty: 10,
    });

    expect(flow.totalDelivered).toBe(3);
    expect(flow.totalUnmet).toBe(2);
    expect(flow.totalCost).toBe(3 * 2 + 2 * 10);
  });
});
