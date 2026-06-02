import {
  type Distribution,
  type Rng,
  assertFiniteNumber,
  normalizeDistribution,
  rngOrDefault,
  sampleIndex,
  uniqueValues,
} from "./core.ts";

export type DiscreteAssignment<V extends string> = Record<V, string>;

export interface Factor<V extends string> {
  variables: readonly V[];
  table: Record<string, number>;
}

export class FactorGraph<V extends string> {
  readonly variables: V[];
  readonly domains: Record<V, readonly string[]>;
  readonly factors: Factor<V>[];

  constructor(config: {
    variables: readonly V[];
    domains: Record<V, readonly string[]>;
    factors: readonly Factor<V>[];
  }) {
    this.variables = uniqueValues(config.variables, "variable");
    this.domains = config.domains;
    this.factors = [...config.factors];
    validateDomains(this.variables, this.domains);
    for (const factor of this.factors) {
      for (const variable of factor.variables) {
        ensureVariable(this.variables, variable);
      }
      for (const value of Object.values(factor.table)) {
        assertPositive(value, "Factor potential");
      }
    }
  }

  jointWeight(assignment: DiscreteAssignment<V>): number {
    validateAssignment(this.variables, this.domains, assignment, false);
    let weight = 1;
    for (const factor of this.factors) {
      const key = assignmentKey(factor.variables.map((variable) => assignment[variable]));
      const value = factor.table[key];
      if (value === undefined) {
        throw new Error(`Missing factor value for ${key}`);
      }
      weight *= value;
    }
    return weight;
  }

  marginal(variable: V, evidence: Partial<DiscreteAssignment<V>> = {}): Distribution<string> {
    ensureVariable(this.variables, variable);
    validateAssignment(this.variables, this.domains, evidence, true);
    const weights: Record<string, number> = {};
    for (const value of this.domains[variable]) weights[value] = 0;
    for (const assignment of enumerateAssignments(this.variables, this.domains, evidence)) {
      weights[assignment[variable]]! += this.jointWeight(assignment);
    }
    return normalizeDistribution(weights);
  }
}

export interface BayesianNetworkConfig<V extends string> {
  variables: readonly V[];
  domains: Record<V, readonly string[]>;
  parents: Record<V, readonly V[]>;
  cpt: Record<V, Record<string, Partial<Record<string, number>>>>;
}

export class BayesianNetwork<V extends string> {
  readonly variables: V[];
  readonly domains: Record<V, readonly string[]>;
  readonly parents: Record<V, readonly V[]>;
  readonly cpt: Record<V, Record<string, Distribution<string>>>;
  readonly order: V[];

  constructor(config: BayesianNetworkConfig<V>) {
    this.variables = uniqueValues(config.variables, "variable");
    this.domains = config.domains;
    this.parents = config.parents;
    validateDomains(this.variables, this.domains);
    this.order = topologicalOrder(this.variables, this.parents);
    this.cpt = {} as Record<V, Record<string, Distribution<string>>>;
    for (const variable of this.variables) {
      const parents = this.parents[variable] ?? [];
      for (const parent of parents) ensureVariable(this.variables, parent);
      const normalizedRows: Record<string, Distribution<string>> = {};
      const rows = config.cpt[variable] ?? {};
      for (const parentValues of enumerateParentValues(parents, this.domains)) {
        const key = assignmentKey(parentValues);
        const row = rows[key];
        if (!row) {
          throw new Error(`Missing CPT row for ${String(variable)} with parents ${key}`);
        }
        normalizedRows[key] = normalizeDistribution(row);
      }
      this.cpt[variable] = normalizedRows;
    }
  }

  sample(options: { rng?: Rng } = {}): DiscreteAssignment<V> {
    const rng = rngOrDefault(options.rng);
    const assignment = {} as DiscreteAssignment<V>;
    for (const variable of this.order) {
      const distribution = this.distributionFor(variable, assignment);
      const values = this.domains[variable];
      assignment[variable] = values[sampleIndex(values.map((value) => distribution[value] ?? 0), rng)]!;
    }
    return assignment;
  }

  jointProbability(assignment: DiscreteAssignment<V>): number {
    validateAssignment(this.variables, this.domains, assignment, false);
    let probability = 1;
    for (const variable of this.order) {
      probability *= this.distributionFor(variable, assignment)[assignment[variable]]!;
    }
    return probability;
  }

  query(variable: V, evidence: Partial<DiscreteAssignment<V>> = {}): Distribution<string> {
    ensureVariable(this.variables, variable);
    validateAssignment(this.variables, this.domains, evidence, true);
    const weights: Record<string, number> = {};
    for (const value of this.domains[variable]) weights[value] = 0;
    for (const assignment of enumerateAssignments(this.variables, this.domains, evidence)) {
      weights[assignment[variable]]! += this.jointProbability(assignment);
    }
    return normalizeDistribution(weights);
  }

  private distributionFor(variable: V, assignment: Partial<DiscreteAssignment<V>>): Distribution<string> {
    const key = assignmentKey((this.parents[variable] ?? []).map((parent) => assignment[parent]));
    const distribution = this.cpt[variable]![key];
    if (!distribution) {
      throw new Error(`Missing CPT distribution for ${String(variable)} and parent key ${key}`);
    }
    return distribution;
  }
}

export interface MarkovRandomFieldConfig<V extends string> {
  variables: readonly V[];
  domains: Record<V, readonly string[]>;
  edges: readonly (readonly [V, V])[];
  unary: Record<V, Partial<Record<string, number>>>;
  pairwise: Record<string, Record<string, number>>;
}

export class MarkovRandomField<V extends string> {
  readonly variables: V[];
  readonly domains: Record<V, readonly string[]>;
  readonly edges: Array<[V, V]>;
  readonly unary: Record<V, Distribution<string>>;
  readonly pairwise: Record<string, Record<string, number>>;

  constructor(config: MarkovRandomFieldConfig<V>) {
    this.variables = uniqueValues(config.variables, "variable");
    this.domains = config.domains;
    this.edges = config.edges.map(([a, b]) => {
      ensureVariable(this.variables, a);
      ensureVariable(this.variables, b);
      return [a, b];
    });
    validateDomains(this.variables, this.domains);
    this.unary = {} as Record<V, Distribution<string>>;
    for (const variable of this.variables) {
      this.unary[variable] = normalizeDistribution(config.unary[variable] ?? {});
    }
    this.pairwise = config.pairwise;
    for (const edge of this.edges) {
      const table = this.pairwise[mrfEdgeKey(edge[0], edge[1])];
      if (!table) {
        throw new Error(`Missing pairwise potential for edge ${mrfEdgeKey(edge[0], edge[1])}`);
      }
      for (const value of Object.values(table)) assertPositive(value, "Pairwise potential");
    }
  }

  energy(assignment: DiscreteAssignment<V>): number {
    validateAssignment(this.variables, this.domains, assignment, false);
    let logWeight = 0;
    for (const variable of this.variables) {
      logWeight += Math.log(this.unary[variable]![assignment[variable]]!);
    }
    for (const [a, b] of this.edges) {
      logWeight += Math.log(this.pairwiseValue(a, b, assignment[a], assignment[b]));
    }
    return -logWeight;
  }

  conditional(variable: V, assignment: DiscreteAssignment<V>): Distribution<string> {
    ensureVariable(this.variables, variable);
    validateAssignment(this.variables, this.domains, assignment, false);
    const weights: Record<string, number> = {};
    for (const value of this.domains[variable]) {
      const candidate = { ...assignment, [variable]: value } as DiscreteAssignment<V>;
      weights[value] = Math.exp(-this.energy(candidate));
    }
    return normalizeDistribution(weights);
  }

  gibbsSample(
    initial: DiscreteAssignment<V>,
    steps: number,
    options: { rng?: Rng } = {},
  ): DiscreteAssignment<V>[] {
    validateAssignment(this.variables, this.domains, initial, false);
    if (!Number.isInteger(steps) || steps < 0) {
      throw new Error(`Steps must be a nonnegative integer; received ${steps}`);
    }
    const rng = rngOrDefault(options.rng);
    let current = { ...initial } as DiscreteAssignment<V>;
    const path = [{ ...current } as DiscreteAssignment<V>];
    for (let step = 0; step < steps; step++) {
      const variable = this.variables[step % this.variables.length]!;
      const distribution = this.conditional(variable, current);
      const values = this.domains[variable];
      current = {
        ...current,
        [variable]: values[sampleIndex(values.map((value) => distribution[value] ?? 0), rng)]!,
      } as DiscreteAssignment<V>;
      path.push({ ...current });
    }
    return path;
  }

  mapLocalSearch(initial: DiscreteAssignment<V>, iterations: number): {
    assignment: DiscreteAssignment<V>;
    energy: number;
  } {
    validateAssignment(this.variables, this.domains, initial, false);
    if (!Number.isInteger(iterations) || iterations < 0) {
      throw new Error(`Iterations must be a nonnegative integer; received ${iterations}`);
    }
    let assignment = { ...initial } as DiscreteAssignment<V>;
    for (let iteration = 0; iteration < iterations; iteration++) {
      for (const variable of this.variables) {
        let bestValue = assignment[variable];
        let bestEnergy = this.energy(assignment);
        for (const value of this.domains[variable]) {
          const candidate = { ...assignment, [variable]: value } as DiscreteAssignment<V>;
          const energy = this.energy(candidate);
          if (energy < bestEnergy) {
            bestEnergy = energy;
            bestValue = value;
          }
        }
        assignment = { ...assignment, [variable]: bestValue } as DiscreteAssignment<V>;
      }
    }
    return { assignment, energy: this.energy(assignment) };
  }

  private pairwiseValue(a: V, b: V, valueA: string, valueB: string): number {
    const table = this.pairwise[mrfEdgeKey(a, b)]!;
    const direct = table[assignmentKey([valueA, valueB])];
    if (direct !== undefined) return direct;
    const reverse = table[assignmentKey([valueB, valueA])];
    if (reverse !== undefined) return reverse;
    throw new Error(`Missing pairwise value for ${String(a)}-${String(b)}`);
  }
}

export function mrfEdgeKey(a: string, b: string): string {
  return [a, b].sort().join("|");
}

function assignmentKey(values: readonly unknown[]): string {
  return JSON.stringify(values);
}

function validateDomains<V extends string>(variables: readonly V[], domains: Record<V, readonly string[]>) {
  for (const variable of variables) {
    const domain = domains[variable];
    if (!domain || domain.length === 0) {
      throw new Error(`Domain for ${String(variable)} must not be empty`);
    }
  }
}

function validateAssignment<V extends string>(
  variables: readonly V[],
  domains: Record<V, readonly string[]>,
  assignment: Partial<DiscreteAssignment<V>>,
  partial: boolean,
) {
  for (const [variable, value] of Object.entries(assignment) as [V, string][]) {
    ensureVariable(variables, variable);
    if (!domains[variable].includes(value)) {
      throw new Error(`Invalid value ${value} for variable ${String(variable)}`);
    }
  }
  if (!partial) {
    for (const variable of variables) {
      if (assignment[variable] === undefined) {
        throw new Error(`Missing assignment for variable ${String(variable)}`);
      }
    }
  }
}

function ensureVariable<V extends string>(variables: readonly V[], variable: V) {
  if (!variables.includes(variable)) {
    throw new Error(`Unknown variable: ${String(variable)}`);
  }
}

function enumerateAssignments<V extends string>(
  variables: readonly V[],
  domains: Record<V, readonly string[]>,
  evidence: Partial<DiscreteAssignment<V>> = {},
): DiscreteAssignment<V>[] {
  let assignments: DiscreteAssignment<V>[] = [{} as DiscreteAssignment<V>];
  for (const variable of variables) {
    const values = evidence[variable] === undefined ? domains[variable] : [evidence[variable]!];
    assignments = assignments.flatMap((assignment) =>
      values.map((value) => ({ ...assignment, [variable]: value }) as DiscreteAssignment<V>),
    );
  }
  return assignments;
}

function enumerateParentValues<V extends string>(
  parents: readonly V[],
  domains: Record<V, readonly string[]>,
): string[][] {
  return enumerateAssignments(parents, domains).map((assignment) => parents.map((parent) => assignment[parent]));
}

function topologicalOrder<V extends string>(
  variables: readonly V[],
  parents: Record<V, readonly V[]>,
): V[] {
  const temporary = new Set<V>();
  const permanent = new Set<V>();
  const order: V[] = [];
  const visit = (variable: V) => {
    if (permanent.has(variable)) return;
    if (temporary.has(variable)) {
      throw new Error("Bayesian network parents must form a DAG");
    }
    temporary.add(variable);
    for (const parent of parents[variable] ?? []) visit(parent);
    temporary.delete(variable);
    permanent.add(variable);
    order.push(variable);
  };
  for (const variable of variables) visit(variable);
  return order;
}

function assertPositive(value: number, label: string) {
  assertFiniteNumber(value, label);
  if (value <= 0) {
    throw new Error(`${label} must be positive; received ${value}`);
  }
}
