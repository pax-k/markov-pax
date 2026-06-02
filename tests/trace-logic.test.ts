import { describe, expect, test } from "bun:test";
import {
  MarkovChain,
  TracePoset,
  createObserverWindow,
  enumerateTraceWindows,
  globalTraceJoin,
  isTraceOf,
  localTraceComplement,
  localTraceJoin,
  localTraceMeet,
  traceChain,
} from "../index.ts";

describe("finite local trace logic", () => {
  test("checks trace relation and enumerates local trace windows", () => {
    const parentChain = MarkovChain.from({
      red: { green: 0.5, yellow: 0.5 },
      green: { red: 0.5, yellow: 0.5 },
      yellow: { red: 0.75, green: 0.25 },
    });
    const parent = createObserverWindow({ name: "parent", chain: parentChain });
    const candidate = traceChain(parentChain, ["red", "green"]);
    const wrong = MarkovChain.from({
      red: { red: 0.9, green: 0.1 },
      green: { red: 0.1, green: 0.9 },
    });

    expect(isTraceOf(candidate, parentChain)).toBe(true);
    expect(isTraceOf(wrong, parentChain)).toBe(false);
    expect(isTraceOf(MarkovChain.from({ other: { other: 1 } }), parentChain)).toBe(false);

    const windows = enumerateTraceWindows(parent, { includeEmpty: true, maxWindows: 3 });
    expect(windows).toHaveLength(3);
    expect(windows[0]!.isEmpty).toBe(true);
    expect(windows[1]!.window?.parent).toBe(parent);
  });

  test("implements local meet, join, complement, and poset operations", () => {
    const parent = createObserverWindow({
      name: "parent",
      chain: MarkovChain.from({
        a: { a: 0.6, b: 0.2, c: 0.2 },
        b: { a: 0.2, b: 0.6, c: 0.2 },
        c: { a: 0.2, b: 0.2, c: 0.6 },
      }),
    });

    const meet = localTraceMeet(parent, ["a", "b"], ["b", "c"]);
    const join = localTraceJoin(parent, ["a"], ["b"]);
    const complement = localTraceComplement(parent, ["a", "b"]);
    const emptyComplement = localTraceComplement(parent, ["a", "b", "c"]);

    expect(meet.visibleStates).toEqual(["b"]);
    expect(join.visibleStates).toEqual(["a", "b"]);
    expect(complement.visibleStates).toEqual(["c"]);
    expect(emptyComplement.isEmpty).toBe(true);

    const poset = new TracePoset(parent, { includeEmpty: true });
    expect(poset.lessOrEqual(meet, join)).toBe(true);
    expect(poset.covers(join, localTraceMeet(parent, ["a"], ["a", "c"]))).toBe(true);
    expect(poset.minimal()[0]!.isEmpty).toBe(true);
    expect(poset.maximal()[0]!.visibleStates).toEqual(["a", "b", "c"]);
  });

  test("rejects unsupported global joins and invalid local logic inputs", () => {
    const parent = createObserverWindow({
      chain: MarkovChain.from({
        a: { a: 1 },
      }),
    });

    expect(() => globalTraceJoin()).toThrow(/Global trace join/i);
    expect(() => localTraceMeet(parent, ["a"], ["missing" as "a"])).toThrow(/unknown visible/i);
    expect(() => localTraceJoin(parent, ["a"], ["missing" as "a"])).toThrow(/unknown visible/i);
    expect(() => localTraceComplement(parent, ["missing" as "a"])).toThrow(/unknown visible/i);
  });
});
