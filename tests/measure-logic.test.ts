import { describe, expect, test } from "bun:test";
import {
  eventAnd,
  eventImplication,
  eventNot,
  eventOr,
  measureOf,
} from "../index.ts";

describe("finite probability-measure event logic", () => {
  test("computes event operations and their finite measures", () => {
    const states = ["rain", "cloud", "sun"] as const;
    const belief = { rain: 0.2, cloud: 0.3, sun: 0.5 };

    const wet = ["rain", "cloud"] as const;
    const bright = ["sun", "cloud"] as const;

    expect(measureOf(belief, wet)).toBeCloseTo(0.5);
    expect(eventNot(states, wet)).toEqual(["sun"]);
    expect(eventAnd(states, wet, bright)).toEqual(["cloud"]);
    expect(eventOr(states, wet, bright)).toEqual(["rain", "cloud", "sun"]);
    expect(eventImplication(states, ["rain"], ["cloud"])).toEqual(["cloud", "sun"]);
  });

  test("rejects invalid finite event and measure inputs", () => {
    expect(() => measureOf<"a" | "b" | "missing">({ a: 0.5, b: 0.5 }, ["missing"])).toThrow(/Unknown event/i);
    expect(() => measureOf({ a: 1.5 }, ["a"])).toThrow(/probability/i);
    expect(() => eventNot(["a"], ["missing" as "a"])).toThrow(/Unknown event/i);
    expect(() => eventAnd(["a"], ["missing" as "a"], ["a"])).toThrow(/Unknown event/i);
    expect(() => eventOr(["a"], ["a"], ["missing" as "a"])).toThrow(/Unknown event/i);
  });
});
