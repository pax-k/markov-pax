import { describe, expect, test } from "bun:test";
import { POMDP } from "../../index.ts";

function sum(values: Iterable<number>) {
  return Array.from(values).reduce((total, value) => total + value, 0);
}

describe("module example: POMDP", () => {
  test("updates a hidden-state belief after an action and observation", () => {
    const pomdp = POMDP.from({
      states: ["LeftRoom", "RightRoom"],
      actions: ["Move"],
      observations: ["hear-left", "hear-right"],
      transition: {
        LeftRoom: { Move: { LeftRoom: 0.3, RightRoom: 0.7 } },
        RightRoom: { Move: { LeftRoom: 0.2, RightRoom: 0.8 } },
      },
      observation: {
        LeftRoom: { Move: { "hear-left": 0.85, "hear-right": 0.15 } },
        RightRoom: { Move: { "hear-left": 0.1, "hear-right": 0.9 } },
      },
    });

    const belief = pomdp.updateBelief({
      belief: { LeftRoom: 0.6, RightRoom: 0.4 },
      action: "Move",
      observation: "hear-right",
    });

    expect(sum(Object.values(belief))).toBeCloseTo(1);
    expect(belief.RightRoom).toBeGreaterThan(belief.LeftRoom);
  });
});
