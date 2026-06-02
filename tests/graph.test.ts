import { describe, expect, test } from "bun:test";
import {
  RandomWalkGraph,
  SeededRng,
  pagerank,
} from "../index.ts";

function expectClose(actual: number, expected: number, tolerance = 1e-8) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

function sum(values: Iterable<number>) {
  return Array.from(values).reduce((total, value) => total + value, 0);
}

function expectDistribution(distribution: Record<string, number>, tolerance = 1e-8) {
  for (const value of Object.values(distribution)) {
    expect(value).toBeGreaterThanOrEqual(-tolerance);
    expect(value).toBeLessThanOrEqual(1 + tolerance);
  }
  expectClose(sum(Object.values(distribution)), 1, tolerance);
}

describe("RandomWalkGraph and PageRank", () => {
  test("walks graphs and ranks important pages", () => {
    const graph = RandomWalkGraph.from({
      Home: ["Docs", "Blog"],
      Docs: ["Home", "API"],
      Blog: ["Docs"],
      API: ["Docs"],
    });

    const transition = graph.transitionMatrix();
    for (const row of transition) {
      expectClose(sum(row), 1);
    }

    const walk = graph.walk("Home", 4, { rng: new SeededRng(2) });
    expect(walk[0]).toBe("Home");
    expect(walk).toHaveLength(5);

    const ranks = pagerank({
      Home: ["Docs", "Blog"],
      Docs: ["Home", "API"],
      Blog: ["Docs"],
      API: ["Docs"],
    });
    expectDistribution(ranks);
    expect(ranks.Docs).toBeGreaterThan(ranks.Blog);
  });

  test("handles dangling nodes and rejects invalid graph/ranking inputs", () => {
    const graph = RandomWalkGraph.from<"Source" | "Sink">({
      Source: ["Sink"],
      Sink: [],
    });

    const transition = graph.transitionMatrix();
    const sinkIndex = graph.nodes.indexOf("Sink");
    expect(transition[sinkIndex]![sinkIndex]).toBe(1);
    expect(() => graph.walk("Missing" as "Source", 1)).toThrow(/unknown graph node/i);

    const ranks = pagerank<"Source" | "Sink">({
      Source: ["Sink"],
      Sink: [],
    });
    expectDistribution(ranks);
    expect(ranks.Sink).toBeGreaterThan(ranks.Source);

    expectDistribution(pagerank({
      Home: ["Docs"],
      Docs: ["Home", "API"],
      API: [],
    }));

    expect(() => pagerank<"A" | "B">({ A: ["B"], B: [] }, { damping: 1.5 })).toThrow(/damping/i);
    expect(() => pagerank<"A" | "B">({ A: ["B"], B: ["A"] }, { maxIterations: 0 })).toThrow(/did not converge/i);
  });
});
