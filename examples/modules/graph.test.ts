import { describe, expect, test } from "bun:test";
import {
  RandomWalkGraph,
  SeededRng,
  pagerank,
} from "../../index.ts";

function sum(values: Iterable<number>) {
  return Array.from(values).reduce((total, value) => total + value, 0);
}

describe("module example: graph random walks and PageRank", () => {
  test("builds graph transitions, simulates a walk, and ranks nodes", () => {
    const graph = RandomWalkGraph.from({
      Home: ["Docs", "Blog"],
      Docs: ["API", "Home"],
      Blog: ["Docs"],
      API: ["Docs"],
    });

    const transition = graph.transitionMatrix();
    const walk = graph.walk("Home", 4, { rng: new SeededRng(8) });
    const ranks = pagerank({
      Home: ["Docs", "Blog"],
      Docs: ["API", "Home"],
      Blog: ["Docs"],
      API: ["Docs"],
    });

    expect(transition).toHaveLength(4);
    expect(walk[0]).toBe("Home");
    expect(sum(Object.values(ranks))).toBeCloseTo(1);
    expect(ranks.Docs).toBeGreaterThan(ranks.Blog);
  });
});
