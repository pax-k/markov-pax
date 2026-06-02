import { describe, expect, test } from "bun:test";
import { MarkovChain, createObserverWindow, localTraceJoin, localTraceMeet } from "../../index.ts";

describe("module example: trace logic", () => {
  test("uses local meet and join as visible-state intersection and union", () => {
    const parent = createObserverWindow({
      chain: MarkovChain.from({
        a: { a: 0.6, b: 0.2, c: 0.2 },
        b: { a: 0.2, b: 0.6, c: 0.2 },
        c: { a: 0.2, b: 0.2, c: 0.6 },
      }),
    });

    expect(localTraceMeet(parent, ["a", "b"], ["b", "c"]).visibleStates).toEqual(["b"]);
    expect(localTraceJoin(parent, ["a", "b"], ["b", "c"]).visibleStates).toEqual(["a", "b", "c"]);
  });
});
