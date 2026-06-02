import {
  DEFAULT_TOLERANCE,
  type Distribution,
  type Matrix,
  type Rng,
  type WeightedTransitions,
  assertFiniteNumber,
  assertProbability,
  identity,
  inverse,
  matrixMultiply,
  rowVectorMatrixMultiply,
  sampleIndex,
  solveLinearSystem,
  subtractMatrices,
  uniqueValues,
  vectorDistance,
  vectorToDistribution,
} from "../shared/core.ts";
import { MarkovChain } from "../chains/markov-chain.ts";
import { isReversible } from "../chains/spectral.ts";

export interface TraceOptions {
  tolerance?: number;
}

export interface SimulateTraceOptions {
  visibleSteps: number;
  maxFullSteps?: number;
  rng?: Rng;
}

export interface SimulatedTracePath<S extends string> {
  fullPath: S[];
  visiblePath: S[];
  fullTicks: number;
  visibleTicks: number;
  hiddenTicks: number;
  dilationRatio: number;
}

export interface CounterDilation {
  fullTicks: number;
  visibleTicks: number;
  hiddenTicks: number;
  dilationRatio: number;
}

export class EnhancedMarkovChain<S extends string> {
  readonly chain: MarkovChain<S>;
  readonly counterName: string;

  constructor(chain: MarkovChain<S>, options: { counterName?: string } = {}) {
    this.chain = chain;
    this.counterName = options.counterName ?? "ticks";
  }

  simulate(start: S, steps: number, options: { rng?: Rng } = {}): { path: S[]; counter: number } {
    const path = this.chain.simulate(start, steps, options);
    return { path, counter: path.length - 1 };
  }

  trace(visibleStates: readonly S[], options: TraceOptions = {}): MarkovChain<S> {
    return traceChain(this.chain, visibleStates, options);
  }
}

export class ObserverWindow<S extends string> {
  readonly name: string;
  readonly chain: MarkovChain<S>;
  readonly visibleStates: S[];
  readonly parent?: ObserverWindow<S>;

  constructor(config: {
    name?: string;
    chain: MarkovChain<S>;
    visibleStates?: readonly S[];
    parent?: ObserverWindow<S>;
  }) {
    this.name = config.name ?? "observer";
    this.chain = config.chain;
    this.visibleStates = config.visibleStates ? validateVisibleStates(config.chain, config.visibleStates).visible : [...config.chain.states];
    this.parent = config.parent;
  }

  stationaryBelief(): Distribution<S> {
    return stationaryBelief(this);
  }

  traceTo(visibleStates: readonly S[], options: TraceOptions & { name?: string } = {}): ObserverWindow<S> {
    return traceToWindow(this, visibleStates, options);
  }
}

export interface TraceSurprise<S extends string> {
  traceWindow: ObserverWindow<S>;
  naiveWindow: ObserverWindow<S>;
  traceLogLikelihood: number;
  naiveLogLikelihood: number;
  traceSurprise: number;
  naiveSurprise: number;
  improvement: number;
}

export interface TraceKernelOnParent<S extends string> {
  parentStates: S[];
  visibleStates: S[];
  support: S[];
  matrix: Matrix;
}

export interface TraceStationaryDiagnostics<S extends string> {
  traced: MarkovChain<S>;
  traceStationary: Distribution<S>;
  restrictedParentStationary: Distribution<S>;
  l1Distance: number;
}

export interface TraceObservationDiagnostics<S extends string> {
  theoretical: MarkovChain<S>;
  empirical: MarkovChain<S>;
  visiblePath: S[];
  l1Distance: number;
}

export interface TraceDynamicsInvariants {
  entropyRate: number;
  determinant: number;
}

export interface TraceLogicElement<S extends string> {
  parent: ObserverWindow<S>;
  visibleStates: S[];
  isEmpty: boolean;
  window?: ObserverWindow<S>;
}

export class TracePoset<S extends string> {
  readonly parent: ObserverWindow<S>;
  readonly elements: TraceLogicElement<S>[];

  constructor(parent: ObserverWindow<S>, options: { includeEmpty?: boolean; maxWindows?: number } = {}) {
    this.parent = parent;
    this.elements = enumerateTraceWindows(parent, options);
  }

  lessOrEqual(left: TraceLogicElement<S>, right: TraceLogicElement<S>): boolean {
    return isSubset(left.visibleStates, right.visibleStates);
  }

  covers(upper: TraceLogicElement<S>, lower: TraceLogicElement<S>): boolean {
    if (!this.lessOrEqual(lower, upper) || equalSets(upper.visibleStates, lower.visibleStates)) return false;
    return !this.elements.some((candidate) =>
      this.lessOrEqual(lower, candidate) &&
      this.lessOrEqual(candidate, upper) &&
      !equalSets(candidate.visibleStates, lower.visibleStates) &&
      !equalSets(candidate.visibleStates, upper.visibleStates)
    );
  }

  minimal(): TraceLogicElement<S>[] {
    return this.elements.filter((element) =>
      !this.elements.some((candidate) => this.lessOrEqual(candidate, element) && !equalSets(candidate.visibleStates, element.visibleStates))
    );
  }

  maximal(): TraceLogicElement<S>[] {
    return this.elements.filter((element) =>
      !this.elements.some((candidate) => this.lessOrEqual(element, candidate) && !equalSets(candidate.visibleStates, element.visibleStates))
    );
  }
}

export class PolicyOverWindows<W extends string> {
  readonly windowNames: W[];
  readonly chain: MarkovChain<W>;
  readonly windows: Partial<Record<W, ObserverWindow<string>>>;

  constructor(config: {
    windowNames: readonly W[];
    transitions: WeightedTransitions<W>;
    windows?: Partial<Record<W, ObserverWindow<string>>>;
  }) {
    this.windowNames = uniqueValues(config.windowNames, "window");
    this.chain = MarkovChain.from(config.transitions);
    if (!sameMembers(this.windowNames, this.chain.states)) {
      throw new Error("Policy window names must match transition states");
    }
    this.windows = { ...(config.windows ?? {}) };
  }

  simulate(start: W, steps: number, options: { rng?: Rng } = {}): W[] {
    return this.chain.simulate(start, steps, options);
  }

  trace(visibleWindows: readonly W[], options: TraceOptions = {}): PolicyOverWindows<W> {
    return tracePolicy(this, visibleWindows, options);
  }
}

export class RecursiveTraceSystem<L extends string> {
  readonly levels: Partial<Record<L, PolicyOverWindows<string>>>;

  constructor(levels: Partial<Record<L, PolicyOverWindows<string>>>) {
    this.levels = { ...levels };
    if (Object.keys(this.levels).length === 0) {
      throw new Error("RecursiveTraceSystem requires at least one level");
    }
  }

  simulateLevel(level: L, start: string, steps: number, options: { rng?: Rng } = {}): string[] {
    const policy = this.levels[level];
    if (!policy) {
      throw new Error(`Unknown recursive trace level: ${String(level)}`);
    }
    return policy.simulate(start, steps, options);
  }
}

export interface ConductanceCut<S extends string> {
  states: S[];
  conductance: number;
}

export interface MarkovOperator<I extends string, O extends string> {
  inputStates: I[];
  outputStates: O[];
  matrix: Matrix;
}

export interface NoCloningResult<I extends string, O extends string> {
  basisStatesCloned: boolean;
  mixtureCloned: boolean;
  distance: number;
  cloned: Distribution<O>;
  idealProduct: Distribution<O>;
}

export function traceChain<S extends string>(
  parent: MarkovChain<S>,
  visibleStates: readonly S[],
  options: TraceOptions = {},
): MarkovChain<S> {
  const tolerance = options.tolerance ?? DEFAULT_TOLERANCE;
  const { visible, hidden } = validateVisibleStates(parent, visibleStates);
  if (hidden.length === 0) {
    return MarkovChain.fromMatrix(visible, submatrix(parent, visible, visible), { tolerance });
  }

  const pAA = submatrix(parent, visible, visible);
  const pAB = submatrix(parent, visible, hidden);
  const pBA = submatrix(parent, hidden, visible);
  const pBB = submatrix(parent, hidden, hidden);

  let fundamental: Matrix;
  try {
    fundamental = inverse(subtractMatrices(identity(hidden.length), pBB), tolerance);
  } catch {
    throw new Error("Cannot trace chain: hidden states may fail to return to the visible window");
  }

  const traced = addMatricesLocal(pAA, matrixMultiply(matrixMultiply(pAB, fundamental), pBA));
  validateTraceRows(traced, tolerance);
  return MarkovChain.fromMatrix(visible, traced, { tolerance });
}

export function traceKernelOnParent<S extends string>(
  parent: MarkovChain<S>,
  visibleStates: readonly S[],
  options: TraceOptions = {},
): TraceKernelOnParent<S> {
  const { visible } = validateVisibleStates(parent, visibleStates);
  const traced = traceChain(parent, visible, options);
  const visibleIndex = new Map(visible.map((state, index) => [state, index]));
  const matrix = parent.states.map((from) => {
    const row = parent.states.map(() => 0);
    const traceRowIndex = visibleIndex.get(from);
    if (traceRowIndex === undefined) return row;
    for (const to of visible) {
      row[parent.states.indexOf(to)] = traced.matrix[traceRowIndex]![visibleIndex.get(to)!]!;
    }
    return row;
  });
  return {
    parentStates: [...parent.states],
    visibleStates: [...visible],
    support: [...visible],
    matrix,
  };
}

export function restrictedStationaryBelief<S extends string>(
  parent: MarkovChain<S>,
  visibleStates: readonly S[],
  options: TraceOptions = {},
): Distribution<S> {
  const tolerance = options.tolerance ?? DEFAULT_TOLERANCE;
  const { visible } = validateVisibleStates(parent, visibleStates);
  const stationary = parent.stationary({ tolerance });
  const visibleMass = visible.reduce((total, state) => total + (stationary[state] ?? 0), 0);
  if (visibleMass <= tolerance) {
    throw new Error("restricted stationary belief requires positive visible stationary mass");
  }
  const result: Partial<Record<S, number>> = {};
  for (const state of visible) result[state] = (stationary[state] ?? 0) / visibleMass;
  return result as Distribution<S>;
}

export function traceStationaryDiagnostics<S extends string>(
  parent: MarkovChain<S>,
  visibleStates: readonly S[],
  options: TraceOptions = {},
): TraceStationaryDiagnostics<S> {
  const traced = traceChain(parent, visibleStates, options);
  const traceStationary = traced.stationary({ tolerance: options.tolerance ?? DEFAULT_TOLERANCE });
  const restrictedParentStationary = restrictedStationaryBelief(parent, traced.states, options);
  const l1Distance = vectorDistance(
    traced.states.map((state) => traceStationary[state] ?? 0),
    traced.states.map((state) => restrictedParentStationary[state] ?? 0),
  );
  return { traced, traceStationary, restrictedParentStationary, l1Distance };
}

export function naiveRestriction<S extends string>(
  parent: MarkovChain<S>,
  visibleStates: readonly S[],
  options: TraceOptions = {},
): MarkovChain<S> {
  const tolerance = options.tolerance ?? DEFAULT_TOLERANCE;
  const { visible } = validateVisibleStates(parent, visibleStates);
  const matrix = submatrix(parent, visible, visible).map((row, rowIndex) => {
    const total = row.reduce((sum, value) => sum + value, 0);
    if (total <= tolerance) {
      throw new Error(`Naive restriction row ${rowIndex} has no visible probability mass`);
    }
    return row.map((value) => value / total);
  });
  return MarkovChain.fromMatrix(visible, matrix, { tolerance });
}

export function estimateTraceFromPath<S extends string>(
  path: readonly S[],
  visibleStates: readonly S[],
  options: { smoothing?: number; tolerance?: number } = {},
): MarkovChain<S> {
  if (path.length === 0) {
    throw new Error("path must contain at least one state");
  }
  const visible = uniqueValues(visibleStates, "visible state");
  if (visible.length === 0) {
    throw new Error("visibleStates must contain at least one state");
  }
  const smoothing = options.smoothing ?? 0;
  assertFiniteNumber(smoothing, "smoothing");
  if (smoothing < 0) {
    throw new Error("smoothing must be nonnegative");
  }
  const visibleSet = new Set(visible);
  const visiblePath = path.filter((state) => visibleSet.has(state));
  if (visiblePath.length < 2) {
    throw new Error("path must contain at least one visible transition");
  }
  const matrix = visible.map(() => visible.map(() => smoothing));
  for (let index = 0; index < visiblePath.length - 1; index++) {
    const from = visible.indexOf(visiblePath[index]!);
    const to = visible.indexOf(visiblePath[index + 1]!);
    const row = matrix[from]!;
    row[to] = row[to]! + 1;
  }
  const normalized = matrix.map((row, rowIndex) => {
    const total = row.reduce((sum, value) => sum + value, 0);
    if (total <= (options.tolerance ?? DEFAULT_TOLERANCE)) {
      throw new Error(`visible state ${String(visible[rowIndex])} has no outgoing observed transitions`);
    }
    return row.map((value) => value / total);
  });
  return MarkovChain.fromMatrix(visible, normalized, { tolerance: options.tolerance ?? DEFAULT_TOLERANCE });
}

export function traceObservationDiagnostics<S extends string>(
  parent: MarkovChain<S>,
  visibleStates: readonly S[],
  path: readonly S[],
  options: { smoothing?: number; tolerance?: number } = {},
): TraceObservationDiagnostics<S> {
  const { visible } = validateVisibleStates(parent, visibleStates);
  const visibleSet = new Set(visible);
  const visiblePath = path.filter((state) => visibleSet.has(state));
  const theoretical = traceChain(parent, visible, options);
  const empirical = estimateTraceFromPath(path, visible, options);
  let l1Distance = 0;
  for (let row = 0; row < theoretical.matrix.length; row++) {
    l1Distance += vectorDistance(theoretical.matrix[row]!, empirical.matrix[row]!);
  }
  return { theoretical, empirical, visiblePath, l1Distance };
}

export function simulateTrace<S extends string>(
  parent: MarkovChain<S>,
  start: S,
  visibleStates: readonly S[],
  options: SimulateTraceOptions,
): SimulatedTracePath<S> {
  if (!Number.isInteger(options.visibleSteps) || options.visibleSteps < 0) {
    throw new Error("visibleSteps must be a nonnegative integer");
  }
  const maxFullSteps = options.maxFullSteps ?? Math.max(100, options.visibleSteps * parent.states.length * 20);
  if (!Number.isInteger(maxFullSteps) || maxFullSteps < options.visibleSteps) {
    throw new Error("maxFullSteps must be an integer at least visibleSteps");
  }
  const visible = new Set(validateVisibleStates(parent, visibleStates).visible);
  if (!parent.states.includes(start)) {
    throw new Error(`Unknown start state: ${String(start)}`);
  }

  const fullPath: S[] = [start];
  const visiblePath: S[] = visible.has(start) ? [start] : [];
  let current = start;
  while (visiblePath.length < options.visibleSteps + 1 && fullPath.length - 1 < maxFullSteps) {
    const nextIndex = sampleIndex(parent.matrix[parent.states.indexOf(current)]!, options.rng);
    current = parent.states[nextIndex]!;
    fullPath.push(current);
    if (visible.has(current)) visiblePath.push(current);
  }
  if (visiblePath.length < options.visibleSteps + 1) {
    throw new Error("Trace simulation did not collect enough visible states");
  }
  const counters = counterDilation(fullPath, [...visible] as S[]);
  return { fullPath, visiblePath, ...counters };
}

export function counterDilation<S extends string>(
  fullPath: readonly S[],
  visibleStates: readonly S[],
): CounterDilation {
  if (fullPath.length === 0) {
    throw new Error("fullPath must contain at least one state");
  }
  const visible = new Set(uniqueValues(visibleStates, "visible state"));
  if (visible.size === 0) {
    throw new Error("visibleStates must contain at least one state");
  }
  let visibleTicks = 0;
  for (let index = 1; index < fullPath.length; index++) {
    if (visible.has(fullPath[index]!)) visibleTicks++;
  }
  const fullTicks = fullPath.length - 1;
  return {
    fullTicks,
    visibleTicks,
    hiddenTicks: fullTicks - visibleTicks,
    dilationRatio: fullTicks === 0 ? 1 : visibleTicks / fullTicks,
  };
}

export function expectedVisibleReturnTime<S extends string>(
  parent: MarkovChain<S>,
  visibleStates: readonly S[],
  options: TraceOptions = {},
): Distribution<S> {
  const tolerance = options.tolerance ?? DEFAULT_TOLERANCE;
  const { visible, hidden } = validateVisibleStates(parent, visibleStates);
  const result: Partial<Record<S, number>> = {};
  if (hidden.length === 0) {
    for (const state of visible) result[state] = 1;
    return result as Distribution<S>;
  }
  const pBB = submatrix(parent, hidden, hidden);
  const system = subtractMatrices(identity(hidden.length), pBB);
  const hiddenTimes = solveLinearSystem(system, Array(hidden.length).fill(1), tolerance);
  for (const state of visible) {
    let time = 1;
    const row = parent.matrix[parent.states.indexOf(state)]!;
    for (let index = 0; index < hidden.length; index++) {
      time += row[parent.states.indexOf(hidden[index]!)]! * hiddenTimes[index]!;
    }
    result[state] = time;
  }
  return result as Distribution<S>;
}

export function createObserverWindow<S extends string>(config: {
  name?: string;
  chain: MarkovChain<S>;
  visibleStates?: readonly S[];
  parent?: ObserverWindow<S>;
}): ObserverWindow<S> {
  return new ObserverWindow(config);
}

export function traceToWindow<S extends string>(
  parentWindow: ObserverWindow<S>,
  visibleStates: readonly S[],
  options: TraceOptions & { name?: string } = {},
): ObserverWindow<S> {
  const chain = traceChain(parentWindow.chain, visibleStates, options);
  return new ObserverWindow({
    name: options.name ?? `${parentWindow.name}:trace`,
    chain,
    visibleStates: chain.states,
    parent: parentWindow,
  });
}

export function stationaryBelief<S extends string>(window: ObserverWindow<S>): Distribution<S> {
  return window.chain.stationary();
}

export function sequenceLogLikelihood<S extends string>(
  window: ObserverWindow<S>,
  observations: readonly S[],
  initial?: Partial<Distribution<S>>,
): number {
  if (observations.length === 0) {
    throw new Error("observations must contain at least one state");
  }
  for (const observation of observations) {
    if (!window.chain.states.includes(observation)) {
      throw new Error(`Unknown observation state: ${String(observation)}`);
    }
  }
  const startDistribution = initial ?? stationaryBelief(window);
  const vector = window.chain.toVector(startDistribution, { normalize: true });
  let probability = vector[window.chain.states.indexOf(observations[0]!)]!;
  if (probability <= 0) return Number.NEGATIVE_INFINITY;
  let logLikelihood = Math.log(probability);
  for (let index = 0; index < observations.length - 1; index++) {
    probability = window.chain.transitionProbability(observations[index]!, observations[index + 1]!);
    if (probability <= 0) return Number.NEGATIVE_INFINITY;
    logLikelihood += Math.log(probability);
  }
  return logLikelihood;
}

export function traceSurprise<S extends string>(
  parentWindow: ObserverWindow<S>,
  visibleStates: readonly S[],
  observations: readonly S[],
  options: TraceOptions = {},
): TraceSurprise<S> {
  const traceWindow = traceToWindow(parentWindow, visibleStates, { ...options, name: `${parentWindow.name}:trace-surprise` });
  const naiveWindow = new ObserverWindow({
    name: `${parentWindow.name}:naive-restriction`,
    chain: naiveRestriction(parentWindow.chain, visibleStates, options),
    parent: parentWindow,
  });
  const traceLogLikelihood = sequenceLogLikelihood(traceWindow, observations);
  const naiveLogLikelihood = sequenceLogLikelihood(naiveWindow, observations);
  return {
    traceWindow,
    naiveWindow,
    traceLogLikelihood,
    naiveLogLikelihood,
    traceSurprise: -traceLogLikelihood,
    naiveSurprise: -naiveLogLikelihood,
    improvement: traceLogLikelihood - naiveLogLikelihood,
  };
}

export function isTraceOf<C extends string, P extends string>(
  candidate: MarkovChain<C>,
  parent: MarkovChain<P>,
  options: TraceOptions = {},
): boolean {
  if (!candidate.states.every((state) => parent.states.includes(state as unknown as P))) return false;
  const traced = traceChain(parent, candidate.states as unknown as P[], options);
  for (const from of candidate.states) {
    for (const to of candidate.states) {
      const residual = Math.abs(
        candidate.transitionProbability(from, to) -
          traced.transitionProbability(from as unknown as P, to as unknown as P),
      );
      if (residual > (options.tolerance ?? DEFAULT_TOLERANCE)) return false;
    }
  }
  return true;
}

export function enumerateTraceWindows<S extends string>(
  parent: ObserverWindow<S>,
  options: { includeEmpty?: boolean; maxWindows?: number } = {},
): TraceLogicElement<S>[] {
  const includeEmpty = options.includeEmpty ?? false;
  const maxWindows = options.maxWindows ?? Number.POSITIVE_INFINITY;
  const elements: TraceLogicElement<S>[] = [];
  const startMask = includeEmpty ? 0 : 1;
  for (let mask = startMask; mask < 2 ** parent.chain.states.length && elements.length < maxWindows; mask++) {
    const visible = parent.chain.states.filter((_state, index) => (mask & (1 << index)) !== 0);
    elements.push(makeTraceLogicElement(parent, visible));
  }
  return elements;
}

export function localTraceMeet<S extends string>(
  parent: ObserverWindow<S>,
  left: readonly S[],
  right: readonly S[],
): TraceLogicElement<S> {
  const rightSet = new Set(validateVisibleStates(parent.chain, right).visible);
  const intersection = validateVisibleStates(parent.chain, left).visible.filter((state) => rightSet.has(state));
  return makeTraceLogicElement(parent, intersection);
}

export function localTraceJoin<S extends string>(
  parent: ObserverWindow<S>,
  left: readonly S[],
  right: readonly S[],
): TraceLogicElement<S> {
  validateVisibleStates(parent.chain, left);
  validateVisibleStates(parent.chain, right);
  return makeTraceLogicElement(parent, [...new Set([...left, ...right])]);
}

export function localTraceComplement<S extends string>(
  parent: ObserverWindow<S>,
  visibleStates: readonly S[],
): TraceLogicElement<S> {
  const visible = new Set(validateVisibleStates(parent.chain, visibleStates).visible);
  return makeTraceLogicElement(parent, parent.chain.states.filter((state) => !visible.has(state)));
}

export function globalTraceJoin(): never {
  throw new Error("Global trace join is not supported; only local joins inside one parent window are implemented");
}

export function createPolicyOverWindows<W extends string>(
  windowNames: readonly W[],
  transitions: WeightedTransitions<W>,
  windows?: Partial<Record<W, ObserverWindow<string>>>,
): PolicyOverWindows<W> {
  return new PolicyOverWindows({ windowNames, transitions, windows });
}

export function simulateWindowPolicy<W extends string>(
  policy: PolicyOverWindows<W>,
  start: W,
  steps: number,
  options: { rng?: Rng } = {},
): W[] {
  return policy.simulate(start, steps, options);
}

export function tracePolicy<W extends string>(
  policy: PolicyOverWindows<W>,
  visibleWindows: readonly W[],
  options: TraceOptions = {},
): PolicyOverWindows<W> {
  const traced = traceChain(policy.chain, visibleWindows, options);
  const windows: Partial<Record<W, ObserverWindow<string>>> = {};
  for (const name of traced.states) {
    if (policy.windows[name]) windows[name] = policy.windows[name];
  }
  return new PolicyOverWindows({
    windowNames: traced.states,
    transitions: matrixToTransitions(traced),
    windows,
  });
}

export function dirichletForm<S extends string>(
  chain: MarkovChain<S>,
  values: Partial<Record<S, number>>,
  stationary: Partial<Distribution<S>> = chain.stationary(),
): number {
  const pi = chain.toVector(stationary, { normalize: true });
  let total = 0;
  for (let i = 0; i < chain.states.length; i++) {
    const fi = valueFor(values, chain.states[i]!);
    for (let j = 0; j < chain.states.length; j++) {
      const difference = fi - valueFor(values, chain.states[j]!);
      total += pi[i]! * chain.matrix[i]![j]! * difference * difference;
    }
  }
  return total / 2;
}

export function conductance<S extends string>(
  chain: MarkovChain<S>,
  subset: readonly S[],
  stationary: Partial<Distribution<S>> = chain.stationary(),
): number {
  const set = new Set(validateProperSubset(chain, subset));
  const pi = chain.toVector(stationary, { normalize: true });
  let mass = 0;
  let flow = 0;
  for (let i = 0; i < chain.states.length; i++) {
    if (!set.has(chain.states[i]!)) continue;
    mass += pi[i]!;
    for (let j = 0; j < chain.states.length; j++) {
      if (!set.has(chain.states[j]!)) flow += pi[i]! * chain.matrix[i]![j]!;
    }
  }
  return flow / Math.min(mass, 1 - mass);
}

export function exitProbability<S extends string>(
  chain: MarkovChain<S>,
  subset: readonly S[],
  stationary: Partial<Distribution<S>> = chain.stationary(),
): number {
  const set = new Set(validateProperSubset(chain, subset));
  const pi = chain.toVector(stationary, { normalize: true });
  let mass = 0;
  let flow = 0;
  for (let i = 0; i < chain.states.length; i++) {
    if (!set.has(chain.states[i]!)) continue;
    mass += pi[i]!;
    for (let j = 0; j < chain.states.length; j++) {
      if (!set.has(chain.states[j]!)) flow += pi[i]! * chain.matrix[i]![j]!;
    }
  }
  return flow / mass;
}

export function hittingTime<S extends string>(
  chain: MarkovChain<S>,
  target: S,
): Distribution<S> {
  if (!chain.states.includes(target)) {
    throw new Error(`Unknown target state: ${String(target)}`);
  }
  const unknown = chain.states.filter((state) => state !== target);
  if (unknown.length === 0) return { [target]: 0 } as Distribution<S>;
  const matrix = unknown.map((state) =>
    unknown.map((other) => (state === other ? 1 : 0) - chain.transitionProbability(state, other)),
  );
  const solution = solveLinearSystem(matrix, Array(unknown.length).fill(1));
  const result: Partial<Record<S, number>> = { [target]: 0 } as Partial<Record<S, number>>;
  for (let index = 0; index < unknown.length; index++) result[unknown[index]!] = solution[index]!;
  return result as Distribution<S>;
}

export function commuteDistance<S extends string>(
  chain: MarkovChain<S>,
  a: S,
  b: S,
): number {
  if (a === b) return 0;
  const toB = hittingTime(chain, b);
  const toA = hittingTime(chain, a);
  return toB[a] + toA[b];
}

export function effectiveResistanceDistance<S extends string>(
  chain: MarkovChain<S>,
  a: S,
  b: S,
): number {
  if (!isReversible(chain)) {
    throw new Error("effectiveResistanceDistance requires a reversible finite chain");
  }
  return commuteDistance(chain, a, b);
}

export function lowConductanceCuts<S extends string>(
  chain: MarkovChain<S>,
  options: { maxCutSize?: number; limit?: number } = {},
): ConductanceCut<S>[] {
  const maxCutSize = options.maxCutSize ?? Math.floor(chain.states.length / 2);
  const limit = options.limit ?? Number.POSITIVE_INFINITY;
  const cuts: ConductanceCut<S>[] = [];
  for (let mask = 1; mask < 2 ** chain.states.length - 1; mask++) {
    const states = chain.states.filter((_state, index) => (mask & (1 << index)) !== 0);
    if (states.length > maxCutSize) continue;
    cuts.push({ states, conductance: conductance(chain, states) });
  }
  return cuts.sort((a, b) => a.conductance - b.conductance).slice(0, limit);
}

export function metastableCommunities<S extends string>(
  chain: MarkovChain<S>,
  options: { threshold?: number; limit?: number } = {},
): ConductanceCut<S>[] {
  const threshold = options.threshold ?? 0.25;
  return lowConductanceCuts(chain, { limit: options.limit }).filter((cut) => cut.conductance <= threshold);
}

export function measureOf<S extends string>(
  distribution: Partial<Distribution<S>>,
  event: readonly S[],
): number {
  const states = Object.keys(distribution) as S[];
  const eventStates = validateEvent(states, event);
  let total = 0;
  for (const state of states) {
    assertProbability(distribution[state] ?? 0, `measure for ${String(state)}`);
    if (eventStates.has(state)) total += distribution[state] ?? 0;
  }
  return total;
}

export function eventNot<S extends string>(states: readonly S[], event: readonly S[]): S[] {
  const eventStates = validateEvent(states, event);
  return uniqueValues(states, "state").filter((state) => !eventStates.has(state));
}

export function eventAnd<S extends string>(states: readonly S[], left: readonly S[], right: readonly S[]): S[] {
  validateEvent(states, left);
  const rightSet = validateEvent(states, right);
  return uniqueValues(left, "event state").filter((state) => rightSet.has(state));
}

export function eventOr<S extends string>(states: readonly S[], left: readonly S[], right: readonly S[]): S[] {
  validateEvent(states, left);
  validateEvent(states, right);
  return [...new Set([...left, ...right])];
}

export function eventImplication<S extends string>(states: readonly S[], antecedent: readonly S[], consequent: readonly S[]): S[] {
  return eventOr(states, eventNot(states, antecedent), consequent);
}

export function stationaryMeasureMap<S extends string>(window: ObserverWindow<S>): Distribution<S> {
  return stationaryBelief(window);
}

export function entropyRate<S extends string>(
  chain: MarkovChain<S>,
  stationary: Partial<Distribution<S>> = chain.stationary(),
): number {
  const pi = chain.toVector(stationary, { normalize: true });
  let entropy = 0;
  for (let i = 0; i < chain.states.length; i++) {
    for (let j = 0; j < chain.states.length; j++) {
      const probability = chain.matrix[i]![j]!;
      if (probability > 0) entropy -= pi[i]! * probability * Math.log2(probability);
    }
  }
  return entropy;
}

export function determinantInvariant<S extends string>(chain: MarkovChain<S>): number {
  return determinantLocal(chain.matrix);
}

export function traceDynamicsInvariants<S extends string>(
  chain: MarkovChain<S>,
  stationary: Partial<Distribution<S>> = chain.stationary(),
): TraceDynamicsInvariants {
  return {
    entropyRate: entropyRate(chain, stationary),
    determinant: determinantInvariant(chain),
  };
}

export function basisStateCloner<S extends string>(states: readonly S[]): MarkovOperator<S, `${S}|${S}`> {
  const inputStates = uniqueValues(states, "state");
  const outputStates = inputStates.flatMap((left) => inputStates.map((right) => `${left}|${right}` as `${S}|${S}`));
  const matrix = inputStates.map((state) => outputStates.map((output) => output === `${state}|${state}` ? 1 : 0));
  return { inputStates, outputStates, matrix };
}

export function applyMarkovOperator<I extends string, O extends string>(
  operator: MarkovOperator<I, O>,
  distribution: Partial<Distribution<I>>,
): Distribution<O> {
  validateOperator(operator);
  const vector = operator.inputStates.map((state) => distribution[state] ?? 0);
  const total = vector.reduce((sum, value, index) => {
    assertFiniteNumber(value, `input distribution for ${String(operator.inputStates[index])}`);
    if (value < 0) throw new Error("input distribution values must be nonnegative");
    return sum + value;
  }, 0);
  if (Math.abs(total - 1) > DEFAULT_TOLERANCE) {
    throw new Error("input distribution must sum to 1");
  }
  return vectorToDistribution(operator.outputStates, rowVectorMatrixMultiply(vector, operator.matrix));
}

export function productDistribution<S extends string>(
  distribution: Partial<Distribution<S>>,
): Distribution<`${S}|${S}`> {
  const states = Object.keys(distribution) as S[];
  const output: Partial<Record<`${S}|${S}`, number>> = {};
  for (const left of states) {
    const leftValue = distribution[left] ?? 0;
    assertProbability(leftValue, `distribution for ${String(left)}`);
    for (const right of states) {
      const rightValue = distribution[right] ?? 0;
      assertProbability(rightValue, `distribution for ${String(right)}`);
      output[`${left}|${right}` as `${S}|${S}`] = leftValue * rightValue;
    }
  }
  return output as Distribution<`${S}|${S}`>;
}

export function verifyNoUniversalLinearCloner<S extends string>(
  operator: MarkovOperator<S, `${S}|${S}`>,
  mixture: Partial<Distribution<S>>,
): NoCloningResult<S, `${S}|${S}`> {
  const cloned = applyMarkovOperator(operator, mixture);
  const idealProduct = productDistribution(mixture);
  const distance = vectorDistance(
    operator.outputStates.map((state) => cloned[state] ?? 0),
    operator.outputStates.map((state) => idealProduct[state] ?? 0),
  );
  let basisStatesCloned = true;
  for (const state of operator.inputStates) {
    const basis = { [state]: 1 } as Partial<Distribution<S>>;
    const clonedBasis = applyMarkovOperator(operator, basis);
    if (clonedBasis[`${state}|${state}` as `${S}|${S}`] !== 1) basisStatesCloned = false;
  }
  return {
    basisStatesCloned,
    mixtureCloned: distance <= DEFAULT_TOLERANCE,
    distance,
    cloned,
    idealProduct,
  };
}

function validateVisibleStates<S extends string>(
  parent: MarkovChain<S>,
  visibleStates: readonly S[],
): { visible: S[]; hidden: S[] } {
  const visible = uniqueValues(visibleStates, "visible state");
  if (visible.length === 0) {
    throw new Error("visibleStates must contain at least one state");
  }
  for (const state of visible) {
    if (!parent.states.includes(state)) {
      throw new Error(`Unknown visible state: ${String(state)}`);
    }
  }
  return {
    visible,
    hidden: parent.states.filter((state) => !visible.includes(state)),
  };
}

function submatrix<S extends string>(chain: MarkovChain<S>, rows: readonly S[], columns: readonly S[]): Matrix {
  return rows.map((rowState) =>
    columns.map((columnState) => chain.transitionProbability(rowState, columnState)),
  );
}

function addMatricesLocal(a: Matrix, b: Matrix): Matrix {
  return a.map((row, rowIndex) => row.map((value, columnIndex) => value + b[rowIndex]![columnIndex]!));
}

function validateTraceRows(matrix: Matrix, tolerance: number) {
  for (let rowIndex = 0; rowIndex < matrix.length; rowIndex++) {
    const rowSum = matrix[rowIndex]!.reduce((sum, value) => sum + value, 0);
    if (Math.abs(rowSum - 1) > tolerance) {
      throw new Error("Cannot trace chain: hidden states may fail to return to the visible window");
    }
  }
}

function makeTraceLogicElement<S extends string>(
  parent: ObserverWindow<S>,
  visibleStates: readonly S[],
): TraceLogicElement<S> {
  const visible = uniqueValues(visibleStates, "visible state");
  if (visible.length === 0) {
    return { parent, visibleStates: [], isEmpty: true };
  }
  return {
    parent,
    visibleStates: visible,
    isEmpty: false,
    window: traceToWindow(parent, visible),
  };
}

function isSubset<S extends string>(left: readonly S[], right: readonly S[]): boolean {
  const rightSet = new Set(right);
  return left.every((state) => rightSet.has(state));
}

function equalSets<S extends string>(left: readonly S[], right: readonly S[]): boolean {
  return left.length === right.length && isSubset(left, right);
}

function sameMembers<S extends string>(left: readonly S[], right: readonly S[]): boolean {
  return equalSets(uniqueValues(left, "left value"), uniqueValues(right, "right value"));
}

function matrixToTransitions<S extends string>(chain: MarkovChain<S>): WeightedTransitions<S> {
  const transitions = {} as WeightedTransitions<S>;
  for (const from of chain.states) {
    transitions[from] = {};
    for (const to of chain.states) transitions[from]![to] = chain.transitionProbability(from, to);
  }
  return transitions;
}

function validateProperSubset<S extends string>(chain: MarkovChain<S>, subset: readonly S[]): S[] {
  const states = validateVisibleStates(chain, subset).visible;
  if (states.length === chain.states.length) {
    throw new Error("subset must be a nonempty proper subset");
  }
  return states;
}

function valueFor<S extends string>(values: Partial<Record<S, number>>, state: S): number {
  const value = values[state];
  if (value === undefined) {
    throw new Error(`Missing value for state ${String(state)}`);
  }
  assertFiniteNumber(value, `value for ${String(state)}`);
  return value;
}

function validateEvent<S extends string>(states: readonly S[], event: readonly S[]): Set<S> {
  const known = uniqueValues(states, "state");
  const eventStates = uniqueValues(event, "event state");
  for (const state of eventStates) {
    if (!known.includes(state)) {
      throw new Error(`Unknown event state: ${String(state)}`);
    }
  }
  return new Set(eventStates);
}

function validateOperator<I extends string, O extends string>(operator: MarkovOperator<I, O>) {
  if (operator.inputStates.length !== operator.matrix.length) {
    throw new Error("operator row count must match inputStates");
  }
  if (operator.outputStates.length === 0) {
    throw new Error("operator must have at least one output state");
  }
  for (let rowIndex = 0; rowIndex < operator.matrix.length; rowIndex++) {
    const row = operator.matrix[rowIndex]!;
    if (row.length !== operator.outputStates.length) {
      throw new Error("operator row width must match outputStates");
    }
    let total = 0;
    for (const value of row) {
      assertProbability(value, "operator probability");
      total += value;
    }
    if (Math.abs(total - 1) > DEFAULT_TOLERANCE) {
      throw new Error("operator rows must sum to 1");
    }
  }
}

function determinantLocal(matrix: Matrix): number {
  const working = matrix.map((row) => [...row]);
  let sign = 1;
  let determinant = 1;
  for (let column = 0; column < working.length; column++) {
    let pivotRow = column;
    for (let row = column + 1; row < working.length; row++) {
      if (Math.abs(working[row]![column]!) > Math.abs(working[pivotRow]![column]!)) {
        pivotRow = row;
      }
    }
    if (Math.abs(working[pivotRow]![column]!) <= DEFAULT_TOLERANCE) {
      return 0;
    }
    if (pivotRow !== column) {
      [working[column], working[pivotRow]] = [working[pivotRow]!, working[column]!];
      sign *= -1;
    }
    const pivot = working[column]![column]!;
    determinant *= pivot;
    for (let row = column + 1; row < working.length; row++) {
      const factor = working[row]![column]! / pivot;
      const targetRow = working[row]!;
      const pivotValues = working[column]!;
      for (let nextColumn = column; nextColumn < working.length; nextColumn++) {
        targetRow[nextColumn] = targetRow[nextColumn]! - factor * pivotValues[nextColumn]!;
      }
    }
  }
  return sign * determinant;
}
