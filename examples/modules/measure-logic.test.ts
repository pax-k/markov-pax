import { describe, expect, test } from "bun:test";
import { eventAnd, eventImplication, eventNot, measureOf } from "../../index.ts";

describe("module example: finite measure logic", () => {
  test("treats finite events as propositions over a belief distribution", () => {
    const states = ["rain", "cloud", "sun"] as const;
    const belief = { rain: 0.2, cloud: 0.3, sun: 0.5 };

    expect(measureOf(belief, ["rain", "cloud"])).toBeCloseTo(0.5);
    expect(eventAnd(states, ["rain", "cloud"], ["cloud", "sun"])).toEqual(["cloud"]);
    expect(eventNot(states, ["rain", "cloud"])).toEqual(["sun"]);
    expect(eventImplication(states, ["rain"], ["cloud"])).toEqual(["cloud", "sun"]);
  });
});
