import { type Rng, assertFiniteNumber, rngOrDefault, sampleIndex, uniqueValues } from "./core.ts";

export type ParticleState<N extends string> = Record<N, number>;

export class InteractingParticleSystem<N extends string> {
  readonly nodes: N[];
  readonly initial: ParticleState<N>;
  private readonly update: (state: ParticleState<N>, rng: Rng, step: number) => ParticleState<N>;

  constructor(config: {
    nodes: readonly N[];
    initial: ParticleState<N>;
    update: (state: ParticleState<N>, rng: Rng, step: number) => ParticleState<N>;
  }) {
    this.nodes = uniqueValues(config.nodes, "node");
    this.initial = { ...config.initial };
    this.update = config.update;
    validateState(this.nodes, this.initial);
  }

  step(state: ParticleState<N>, options: { rng?: Rng; step?: number } = {}): ParticleState<N> {
    validateState(this.nodes, state);
    const next = this.update({ ...state }, rngOrDefault(options.rng), options.step ?? 0);
    validateState(this.nodes, next);
    return next;
  }

  simulate(steps: number, options: { rng?: Rng } = {}): ParticleState<N>[] {
    if (!Number.isInteger(steps) || steps < 0) {
      throw new Error(`Steps must be a nonnegative integer; received ${steps}`);
    }
    const rng = rngOrDefault(options.rng);
    const path = [{ ...this.initial }];
    let current = { ...this.initial };
    for (let step = 0; step < steps; step++) {
      current = this.step(current, { rng, step });
      path.push({ ...current });
    }
    return path;
  }

  stateCounts(state: ParticleState<N>): Record<number, number> {
    validateState(this.nodes, state);
    const counts: Record<number, number> = {};
    for (const node of this.nodes) {
      counts[state[node]] = (counts[state[node]] ?? 0) + 1;
    }
    return counts;
  }

  consensusReached(state: ParticleState<N>): boolean {
    validateState(this.nodes, state);
    return new Set(this.nodes.map((node) => state[node])).size === 1;
  }
}

export function voterModel<N extends string>(
  graph: Record<N, readonly N[]>,
  initial: ParticleState<N>,
): InteractingParticleSystem<N> {
  const nodes = Object.keys(graph) as N[];
  validateGraph(graph, nodes);
  return new InteractingParticleSystem({
    nodes,
    initial,
    update(state, rng) {
      const node = nodes[sampleIndex(nodes.map(() => 1), rng)]!;
      const neighbors = graph[node]!;
      state[node] = state[neighbors[sampleIndex(neighbors.map(() => 1), rng)]!]!;
      return state;
    },
  });
}

export function contactProcess<N extends string>(
  graph: Record<N, readonly N[]>,
  initial: ParticleState<N>,
  infectionProbability: number,
  recoveryProbability: number,
): InteractingParticleSystem<N> {
  validateProbability(infectionProbability, "Infection probability");
  validateProbability(recoveryProbability, "Recovery probability");
  const nodes = Object.keys(graph) as N[];
  validateGraph(graph, nodes);
  return new InteractingParticleSystem({
    nodes,
    initial,
    update(state, rng) {
      const node = nodes[sampleIndex(nodes.map(() => 1), rng)]!;
      if (state[node] === 1 && rng.next() < recoveryProbability) {
        state[node] = 0;
      } else if (state[node] === 1) {
        const neighbor = graph[node]![sampleIndex(graph[node]!.map(() => 1), rng)]!;
        if (rng.next() < infectionProbability) state[neighbor] = 1;
      }
      return state;
    },
  });
}

export function exclusionProcess<N extends string>(
  graph: Record<N, readonly N[]>,
  initial: ParticleState<N>,
): InteractingParticleSystem<N> {
  const nodes = Object.keys(graph) as N[];
  validateGraph(graph, nodes);
  return new InteractingParticleSystem({
    nodes,
    initial,
    update(state, rng) {
      const occupied = nodes.filter((node) => state[node] === 1);
      if (occupied.length === 0) return state;
      const node = occupied[sampleIndex(occupied.map(() => 1), rng)]!;
      const neighbor = graph[node]![sampleIndex(graph[node]!.map(() => 1), rng)]!;
      if (state[neighbor] === 0) {
        state[node] = 0;
        state[neighbor] = 1;
      }
      return state;
    },
  });
}

export function glauberIsingModel<N extends string>(
  graph: Record<N, readonly N[]>,
  initial: ParticleState<N>,
  beta: number,
): InteractingParticleSystem<N> {
  assertFiniteNumber(beta, "Ising beta");
  const nodes = Object.keys(graph) as N[];
  validateGraph(graph, nodes);
  return new InteractingParticleSystem({
    nodes,
    initial,
    update(state, rng) {
      const node = nodes[sampleIndex(nodes.map(() => 1), rng)]!;
      const field = graph[node]!.reduce((total, neighbor) => total + state[neighbor], 0);
      const probabilityPlus = 1 / (1 + Math.exp(-2 * beta * field));
      state[node] = rng.next() < probabilityPlus ? 1 : -1;
      return state;
    },
  });
}

function validateGraph<N extends string>(graph: Record<N, readonly N[]>, nodes: readonly N[]) {
  for (const node of nodes) {
    if (!graph[node] || graph[node]!.length === 0) {
      throw new Error(`Graph node ${String(node)} must have at least one neighbor`);
    }
    for (const neighbor of graph[node]!) {
      if (!nodes.includes(neighbor)) {
        throw new Error(`Unknown graph neighbor: ${String(neighbor)}`);
      }
    }
  }
}

function validateState<N extends string>(nodes: readonly N[], state: ParticleState<N>) {
  for (const node of nodes) {
    assertFiniteNumber(state[node], `Particle state for ${String(node)}`);
  }
}

function validateProbability(value: number, label: string) {
  assertFiniteNumber(value, label);
  if (value < 0 || value > 1) {
    throw new Error(`${label} must be in [0, 1]; received ${value}`);
  }
}
