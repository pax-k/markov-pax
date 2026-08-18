import { expect, test } from "bun:test";
import {
  ConstrainedMDP,
  DisruptedSupplyNetwork,
  InventorySystem,
  RouteAvailabilityModel,
  SupplyNetwork,
} from "../../index.ts";

test("synthetic disruption reduces capacity and selects an alternate sustainment action", () => {
  const routeStatus = new RouteAvailabilityModel({
    transitions: {
      Open: { Open: 0.9, Restricted: 0.1 },
      Restricted: { Open: 0.35, Restricted: 0.65 },
    },
    capacityByStatus: { Open: 1, Restricted: 0.3 },
  });
  const baseCapacity = routeStatus.expectedCapacity(100, { Open: 1, Restricted: 0 });
  const disruptedForecast = routeStatus.forecast({ Open: 0.25, Restricted: 0.75 }, 2);
  const disruptedCapacity = routeStatus.expectedCapacity(100, disruptedForecast);

  const network = SupplyNetwork.from({
    nodes: ["Depot", "Relay", "SupportSite"],
    routes: [
      { from: "Depot", to: "SupportSite", capacity: 80, cost: 1, time: 1 },
      { from: "Depot", to: "Relay", capacity: 55, cost: 2, time: 2 },
      { from: "Relay", to: "SupportSite", capacity: 50, cost: 2, time: 2 },
    ],
  });
  const disruptedNetwork = new DisruptedSupplyNetwork(network, {
    unavailableRoutes: ["Depot->SupportSite"],
  }).apply();
  const alternatePath = disruptedNetwork.shortestPath("Depot", "SupportSite");

  const inventory = new InventorySystem({
    facilities: ["Depot", "Relay"],
    products: ["GeneralSupply"],
    quantities: { Depot: { GeneralSupply: 35 }, Relay: { GeneralSupply: 20 } },
    capacities: { Depot: 60, Relay: 30 },
    shortageCosts: { GeneralSupply: 4 },
  });
  const demand = inventory.serveDemand({ GeneralSupply: 45 }, ["Relay", "Depot"]);

  const sustainment = new ConstrainedMDP({
    mdp: {
      states: ["RoutesOpen", "RoutesDisrupted"],
      actions: ["UsePrimary", "UseAlternate", "PrePosition"],
      discount: 0.8,
      transition: {
        RoutesOpen: {
          UsePrimary: { RoutesOpen: 0.9, RoutesDisrupted: 0.1 },
          UseAlternate: { RoutesOpen: 0.85, RoutesDisrupted: 0.15 },
          PrePosition: { RoutesOpen: 0.95, RoutesDisrupted: 0.05 },
        },
        RoutesDisrupted: {
          UsePrimary: { RoutesOpen: 0.2, RoutesDisrupted: 0.8 },
          UseAlternate: { RoutesOpen: 0.65, RoutesDisrupted: 0.35 },
          PrePosition: { RoutesOpen: 0.55, RoutesDisrupted: 0.45 },
        },
      },
      reward: {
        RoutesOpen: { UsePrimary: 6, UseAlternate: 3, PrePosition: 4 },
        RoutesDisrupted: { UsePrimary: -8, UseAlternate: 6, PrePosition: 5 },
      },
    },
    costs: {
      RoutesOpen: { UsePrimary: 1, UseAlternate: 2, PrePosition: 3 },
      RoutesDisrupted: { UsePrimary: 2, UseAlternate: 3, PrePosition: 3 },
    },
    budget: 15,
  });
  const policy = sustainment.solve({ start: "RoutesDisrupted" });

  expect(disruptedCapacity).toBeLessThan(baseCapacity);
  expect(alternatePath.nodes).toEqual(["Depot", "Relay", "SupportSite"]);
  expect(demand.unmet.GeneralSupply).toBe(0);
  expect(["UseAlternate", "PrePosition"]).toContain(policy.policy.RoutesDisrupted);
  expect(policy.feasible).toBe(true);
});
