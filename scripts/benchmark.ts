import {
  MarkovChain,
  createObserverWindow,
  enumerateTraceWindows,
  lowConductanceCuts,
} from "../index.ts";

const stateCount = 12;
const states = Array.from({ length: stateCount }, (_, index) => `s${index}`);
const matrix = states.map((_state, index) => {
  const row = Array(stateCount).fill(0) as number[];
  row[index] = 0.6;
  row[(index + 1) % stateCount] = 0.2;
  row[(index + stateCount - 1) % stateCount] = 0.2;
  return row;
});
const chain = MarkovChain.fromMatrix(states, matrix);
const observer = createObserverWindow({ name: "benchmark-ring", chain });

const enumerationStart = performance.now();
const windows = enumerateTraceWindows(observer);
const enumerationMs = performance.now() - enumerationStart;
if (windows.length !== 2 ** stateCount - 1) {
  throw new Error(`Expected ${2 ** stateCount - 1} nonempty trace windows; received ${windows.length}`);
}

const conductanceStart = performance.now();
const cuts = lowConductanceCuts(chain, {
  maxCutSize: stateCount / 2,
  maxCandidates: 3_000,
  limit: 10,
});
const conductanceMs = performance.now() - conductanceStart;
if (cuts.length !== 10 || cuts.some((cut) => !Number.isFinite(cut.conductance))) {
  throw new Error("Conductance benchmark returned an invalid result");
}

console.log(JSON.stringify({
  stateCount,
  traceWindows: windows.length,
  traceEnumerationMs: Number(enumerationMs.toFixed(2)),
  conductanceCandidates: 2_509,
  returnedCuts: cuts.length,
  conductanceSearchMs: Number(conductanceMs.toFixed(2)),
}, null, 2));
