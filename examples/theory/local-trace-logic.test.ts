import { describe, expect, test } from "bun:test";
import { MarkovChain, createObserverWindow, localTraceComplement, localTraceJoin, localTraceMeet } from "../../index.ts";

describe("theory example: local trace logic", () => {
  test("uses intersection, union, and complement inside one parent window", () => {
    const parent = createObserverWindow({
      chain: MarkovChain.from({
        a: { a: 0.6, b: 0.2, c: 0.2 },
        b: { a: 0.2, b: 0.6, c: 0.2 },
        c: { a: 0.2, b: 0.2, c: 0.6 },
      }),
    });

    expect(localTraceMeet(parent, ["a", "b"], ["b", "c"]).visibleStates).toEqual(["b"]);
    expect(localTraceJoin(parent, ["a"], ["c"]).visibleStates).toEqual(["a", "c"]);
    expect(localTraceComplement(parent, ["a", "b"]).visibleStates).toEqual(["c"]);
  });
});
