import {
  DEFAULT_MAX_ITERATIONS,
  DEFAULT_TOLERANCE,
  type Matrix,
  type Rng,
  sampleIndex,
  uniqueValues,
  vectorDistance,
  vectorToDistribution,
} from "./core.ts";

export type GraphAdjacency<N extends string = string> = Record<N, readonly N[]>;

export class RandomWalkGraph<N extends string> {
  readonly nodes: N[];
  readonly adjacency: Record<N, N[]>;

  constructor(adjacency: GraphAdjacency<N>) {
    const nodes = new Set<N>();
    for (const [from, targets] of Object.entries(adjacency) as [N, N[]][]) {
      nodes.add(from);
      for (const target of targets) {
        nodes.add(target);
      }
    }

    this.nodes = uniqueValues([...nodes], "node");
    this.adjacency = {} as Record<N, N[]>;
    for (const node of this.nodes) {
      this.adjacency[node] = [...(adjacency[node] ?? [])];
    }
  }

  static from<N extends string>(adjacency: GraphAdjacency<N>): RandomWalkGraph<N> {
    return new RandomWalkGraph(adjacency);
  }

  transitionMatrix(): Matrix {
    const indexByNode = new Map(this.nodes.map((node, index) => [node, index]));
    return this.nodes.map((node) => {
      const row = Array(this.nodes.length).fill(0) as number[];
      const targets = this.adjacency[node];
      if (targets.length === 0) {
        row[this.nodes.indexOf(node)] = 1;
        return row;
      }

      for (const target of targets) {
        const index = indexByNode.get(target);
        if (index === undefined) {
          throw new Error(`Unknown graph node: ${String(target)}`);
        }
        row[index] = row[index]! + 1 / targets.length;
      }
      return row;
    });
  }

  walk(start: N, steps: number, options: { rng?: Rng } = {}): N[] {
    if (!this.nodes.includes(start)) {
      throw new Error(`Unknown graph node: ${String(start)}`);
    }
    if (!Number.isInteger(steps) || steps < 0) {
      throw new Error(`Steps must be a nonnegative integer; received ${steps}`);
    }

    const matrix = this.transitionMatrix();
    let currentIndex = this.nodes.indexOf(start);
    const path = [start];
    for (let i = 0; i < steps; i++) {
      currentIndex = sampleIndex(matrix[currentIndex]!, options.rng);
      path.push(this.nodes[currentIndex]!);
    }
    return path;
  }
}

export function pagerank<N extends string>(
  adjacency: GraphAdjacency<N>,
  options: {
    damping?: number;
    tolerance?: number;
    maxIterations?: number;
  } = {},
): Record<N, number> {
  const graph = RandomWalkGraph.from(adjacency);
  const nodes = graph.nodes;
  const n = nodes.length;
  if (n === 0) {
    throw new Error("PageRank graph must contain at least one node");
  }

  const damping = options.damping ?? 0.85;
  if (!Number.isFinite(damping) || damping < 0 || damping > 1) {
    throw new Error("PageRank damping must be in [0, 1]");
  }

  const indexByNode = new Map(nodes.map((node, index) => [node, index]));
  let rank = Array(n).fill(1 / n) as number[];
  const tolerance = options.tolerance ?? DEFAULT_TOLERANCE;
  const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const next = Array(n).fill((1 - damping) / n) as number[];

    for (let fromIndex = 0; fromIndex < n; fromIndex++) {
      const from = nodes[fromIndex]!;
      const targets = graph.adjacency[from];
      if (targets.length === 0) {
        for (let toIndex = 0; toIndex < n; toIndex++) {
          next[toIndex] = next[toIndex]! + damping * rank[fromIndex]! / n;
        }
      } else {
        for (const target of targets) {
          const toIndex = indexByNode.get(target);
          if (toIndex === undefined) {
            throw new Error(`Unknown graph node: ${String(target)}`);
          }
          next[toIndex] = next[toIndex]! + damping * rank[fromIndex]! / targets.length;
        }
      }
    }

    if (vectorDistance(rank, next) <= tolerance) {
      return vectorToDistribution(nodes, normalize(next));
    }
    rank = next;
  }

  throw new Error(`PageRank did not converge in ${maxIterations} iterations`);
}

function normalize(vector: readonly number[]): number[] {
  const total = vector.reduce((acc, value) => acc + value, 0);
  return vector.map((value) => value / total);
}
